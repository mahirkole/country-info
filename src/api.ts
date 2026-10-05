import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type pg from 'pg';
import { config } from './config.js';
import { installAccessControl } from './access.js';

import { openApiSpec } from './openapi.js';
import { WEBHOOK_EVENTS } from './webhooks.js';
import { UN_SQL, withUn } from './export.js';
import { CATALOG, DEFAULT_SCOPES, SCHEMA_VERSION, scopeById } from './scopes/catalog.js';
import { catalogDocument, composeProfile, globalSchema, schemaFor, validateScopes, type Mode } from './scopes/schema.js';
import { createStore, exportLinks, PROFILES, type Profile } from './publish.js';
import { contentTypeOf, FsStore, type ObjectStore } from './object-store.js';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';


const COLS = 'id, kind, parent_id, country_code::text AS country_code, code, name, name_ascii, lat, lon, data, source_id, updated_seq';
const MAX_LIMIT = 1000;

/** `?official_only=true` keeps only records of sources whose class is `official` (community sources such as GeoNames/Wikidata are left out). */
const OFFICIAL = "source_id IN (SELECT id FROM sources WHERE source_class = 'official')";
const flag = (v?: string) => v === 'true' || v === '1';
/**
 * `?canonical=true` drops a record when it is linked (entity_links) to a record from a source with a higher priority,
 * so each linked place appears once, as its best-sourced version.
 */
const CANONICAL = `NOT EXISTS (
  SELECT 1 FROM entity_links l
  JOIN entities o ON o.id = CASE WHEN l.a_id = entities.id THEN l.b_id ELSE l.a_id END
  JOIN sources so ON so.id = o.source_id
  JOIN sources sm ON sm.id = entities.source_id
  WHERE (l.a_id = entities.id OR l.b_id = entities.id) AND so.priority > sm.priority)`;
type Scope = { official_only?: string; canonical?: string };
const officialOnly = (q: Scope) => `${flag(q.official_only) ? `AND ${OFFICIAL}` : ''} ${flag(q.canonical) ? `AND ${CANONICAL}` : ''}`;

function page(q: { limit?: string; after?: string }) {
  const limit = Math.min(Math.max(parseInt(q.limit ?? '100', 10) || 100, 1), MAX_LIMIT);
  return { limit, after: q.after ?? '' };
}

declare module 'fastify' {
  interface FastifyInstance { routeList: Set<string> }
}

export async function buildApp(pool: pg.Pool, opts: { adminToken?: string; exportDir?: string; apiKeys?: string[]; rateLimitPerMin?: number; requireApiKey?: boolean; rateLimitStore?: string; store?: ObjectStore | null } = {}): Promise<FastifyInstance> {
  const adminToken = opts.adminToken ?? config.adminToken;
  const app = Fastify({ logger: false });
  const routes = new Set<string>();
  app.addHook('onRoute', (r) => { for (const m of [r.method].flat()) if (m !== 'HEAD' && m !== 'OPTIONS') routes.add(`${m.toLowerCase()} ${r.url}`); });
  app.decorate('routeList', routes);
  const keyCache = new Map<string, { at: number; v: { id: string; ratePerMin: number | null } | null }>();
  const sha = (k: string) => createHash('sha256').update(k).digest('hex');
  // Usage metering: counts per key and day are kept in memory and flushed to api_usage every 10 s and on close.
  const usage = new Map<string, number>();
  const flushUsage = async () => {
    const batch = [...usage];
    usage.clear();
    const day = new Date().toISOString().slice(0, 10);
    for (const [id, n] of batch) {
      const keyId = id.startsWith('dbkey:') ? Number(id.slice(6)) : 0;
      await pool.query('INSERT INTO api_usage (day, key_id, requests) VALUES ($1, $2, $3) ON CONFLICT (day, key_id) DO UPDATE SET requests = api_usage.requests + $3', [day, keyId, n]).catch(() => undefined);
    }
  };
  const flushTimer = setInterval(() => void flushUsage(), 10_000);
  flushTimer.unref();
  app.addHook('onClose', async () => { clearInterval(flushTimer); await flushUsage(); });
  installAccessControl(app, {
    onUse: (id) => usage.set(id, (usage.get(id) ?? 0) + 1),
    apiKeys: opts.apiKeys ?? config.apiKeys, perWindow: opts.rateLimitPerMin ?? config.rateLimitPerMin, adminToken, requireKey: opts.requireApiKey ?? config.requireApiKey,
    store: (opts.rateLimitStore ?? config.rateLimitStore) === 'postgres'
      ? async (bucket, start) => {
          const r = await pool.query('INSERT INTO rate_limits (bucket, window_start, count) VALUES ($1, $2, 1) ON CONFLICT (bucket, window_start) DO UPDATE SET count = rate_limits.count + 1 RETURNING count', [bucket, start]);
          if (Math.random() < 0.01) void pool.query('DELETE FROM rate_limits WHERE window_start < $1', [start - 300]).catch(() => undefined); // drop stale windows now and then
          return r.rows[0].count as number;
        }
      : undefined,
    // Database-managed keys: looked up by hash, cached for 30 s so revocation takes effect quickly without a query per request.
    resolveKey: async (key) => {
      const h = sha(key);
      const hit = keyCache.get(h);
      if (hit && Date.now() - hit.at < 30_000) return hit.v;
      const row = (await pool.query('SELECT id, rate_per_min FROM api_keys WHERE key_hash = $1 AND active', [h])).rows[0];
      const v = row ? { id: String(row.id), ratePerMin: row.rate_per_min as number | null } : null;
      keyCache.set(h, { at: Date.now(), v });
      if (v) void pool.query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [row.id]).catch(() => undefined);
      return v;
    },
  });

  const requireAdmin = async (req: { headers: Record<string, unknown> }, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) => {
    if (!adminToken || req.headers['authorization'] !== `Bearer ${adminToken}`) return reply.code(401).send({ error: 'unauthorized' });
  };

  app.get('/healthz', async () => ({ ok: true }));
  app.get('/openapi.json', async () => openApiSpec());

  // ---- countries -------------------------------------------------------
  app.get<{ Querystring: { limit?: string; after?: string; un_status?: string; continent?: string } }>('/v1/countries', async (req) => {
    const { limit, after } = page(req.query);
    const { un_status, continent } = req.query;
    const rows = (
      await pool.query(
        `SELECT ${COLS}, ${UN_SQL} AS un_x FROM entities WHERE kind = 'country' AND code > $1
           AND ($2::text IS NULL OR ${UN_SQL} = $2) AND ($3::text IS NULL OR data->>'continent' = $3)
         ORDER BY code LIMIT $4`,
        [after, un_status ?? null, continent ?? null, limit + 1],
      )
    ).rows.map(withUn);
    return paged(rows, limit, 'code');
  });

  app.get<{ Params: { code: string }; Querystring: SelQuery }>('/v1/countries/:code', async (req, reply) => {
    if (req.query.scopes || req.query.profile) {
      const sel = await selection(req.query, who(req), req.apiKeyId, req.params.code);
      if ('error' in sel) return reply.code(400).send({ error: sel.error });
      const doc = await composeProfile(pool, sel.countries, sel.scopes, 'union', optsOf(sel));
      const cc = sel.countries[0]!;
      return doc.data[cc] ? { code: cc, schema_version: doc.schema_version, scopes: doc.data[cc], omitted: doc.omitted } : reply.code(404).send({ error: 'not_found' });
    }
    const r = await pool.query(`SELECT ${COLS}, ${UN_SQL} AS un_x FROM entities WHERE kind = 'country' AND code = $1`, [req.params.code.toUpperCase()]);
    if (!r.rows[0]) return reply.code(404).send({ error: 'not_found' });
    r.rows[0] = withUn(r.rows[0]);
    const names = Object.fromEntries((await pool.query("SELECT lang, name FROM entity_names WHERE entity_id = $1 ORDER BY lang, (source = 'wikidata') DESC, source", [r.rows[0].id])).rows.map((n) => [n.lang, n.name]));
    const xrefs = (await pool.query('SELECT scheme, value, source FROM entity_xrefs WHERE entity_id = $1 AND value IS NOT NULL', [r.rows[0].id])).rows;
    return { ...r.rows[0], names, xrefs };
  });

  app.get<{ Params: { code: string }; Querystring: { level?: string; limit?: string; after?: string; official_only?: string; canonical?: string } }>(
    '/v1/countries/:code/regions',
    async (req, reply) => {
      const cc = req.params.code.toUpperCase();
      const kind = req.query.level === '2' ? 'admin2' : req.query.level === '1' || !req.query.level ? 'admin1' : null;
      if (!kind) return reply.code(400).send({ error: 'level must be 1 or 2' });
      const { limit, after } = page(req.query);
      const rows = (
        await pool.query(`SELECT ${COLS} FROM entities WHERE country_code = $1 AND kind = $2 AND id > $3 ${officialOnly(req.query)} ORDER BY id LIMIT $4`, [cc, kind, after, limit + 1])
      ).rows;
      return paged(rows, limit, 'id');
    },
  );

  // ---- holidays --------------------------------------------------------
  /**
   * Holidays of a country for a year. Without `region` only nationwide holidays are returned;
   * with `region=<entity id>` the holidays of that region and its ancestors are added.
   */
  app.get<{ Params: { code: string }; Querystring: { year?: string; region?: string; type?: string } }>('/v1/countries/:code/holidays', async (req, reply) => {
    const cc = req.params.code.toUpperCase();
    const year = Number(req.query.year ?? new Date().getUTCFullYear());
    if (!Number.isInteger(year) || year < 1900 || year > 2200) return reply.code(400).send({ error: 'invalid year' });
    const rows = (
      await pool.query(
        `WITH RECURSIVE chain AS (
           SELECT id, parent_id FROM entities WHERE id = $4::text
           UNION SELECT e.id, e.parent_id FROM entities e JOIN chain c ON e.id = c.parent_id
         )
         SELECT ${COLS} FROM entities
         WHERE kind = 'holiday' AND country_code = $1 AND data->>'date' >= $2 AND data->>'date' <= $3
           AND ($5::text IS NULL OR data->>'type' = $5)
           AND (parent_id = 'country:' || $1 OR parent_id IN (SELECT id FROM chain))
         ORDER BY data->>'date', id`,
        [cc, `${year}-01-01`, `${year}-12-31`, req.query.region ?? null, req.query.type ?? null],
      )
    ).rows;
    return { data: rows };
  });

  /** Per country: year range and how many holiday records are verified against an official text. */
  app.get('/v1/holidays/coverage', async () => ({
    data: (
      await pool.query(
        `SELECT country_code::text AS country, min((data->>'date')::date)::text AS first_date, max((data->>'date')::date)::text AS last_date,
                count(*)::int AS total,
                count(*) FILTER (WHERE data->>'verification' = 'verified')::int AS verified,
                count(*) FILTER (WHERE data->>'verification' = 'unverified')::int AS unverified,
                count(*) FILTER (WHERE data->>'verification' = 'tentative')::int AS tentative
         FROM entities WHERE kind = 'holiday' GROUP BY 1 ORDER BY 1`,
      )
    ).rows,
  }));

  /** Holidays on one date, optionally for one country (all scopes, including regional). */
  app.get<{ Querystring: { date?: string; country?: string } }>('/v1/holidays', async (req, reply) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.date ?? '')) return reply.code(400).send({ error: 'date must be YYYY-MM-DD' });
    const rows = (
      await pool.query(
        `SELECT ${COLS} FROM entities WHERE kind = 'holiday' AND data->>'date' = $1 AND ($2::text IS NULL OR country_code = $2) ORDER BY country_code, id LIMIT 1000`,
        [req.query.date, req.query.country?.toUpperCase() ?? null],
      )
    ).rows;
    return { data: rows };
  });

  /**
   * Administrative divisions from national sources, any level and local type.
   * `source` limits to one source id (e.g. nat-fr); `level` is 1 = first level below the country.
   */
  app.get<{ Params: { code: string }; Querystring: { level?: string; type?: string; source?: string; limit?: string; after?: string; official_only?: string; canonical?: string } }>(
    '/v1/countries/:code/divisions',
    async (req) => {
      const { limit, after } = page(req.query);
      const rows = (
        await pool.query(
          `SELECT ${COLS} FROM entities WHERE kind = 'division' AND country_code = $1 AND id > $2
             AND ($3::text IS NULL OR source_id = $3) AND ($4::int IS NULL OR (data->>'level')::int = $4) AND ($5::text IS NULL OR data->>'type' = $5) ${officialOnly(req.query)}
           ORDER BY id LIMIT $6`,
          [req.params.code.toUpperCase(), after, req.query.source ?? null, req.query.level ? Number(req.query.level) : null, req.query.type ?? null, limit + 1],
        )
      ).rows;
      return paged(rows, limit, 'id');
    },
  );

  // ---- regions ---------------------------------------------------------
  app.get<{ Params: { id: string } }>('/v1/regions/:id', async (req, reply) => {
    const r = await pool.query(`SELECT ${COLS} FROM entities WHERE id = $1`, [req.params.id]);
    if (!r.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const links = (
      await pool.query(
        `SELECT CASE WHEN a_id = $1 THEN b_id ELSE a_id END AS id, relation, confidence, method FROM entity_links WHERE a_id = $1 OR b_id = $1 ORDER BY 1`,
        [req.params.id],
      )
    ).rows;
    const names = Object.fromEntries((await pool.query("SELECT lang, name FROM entity_names WHERE entity_id = $1 ORDER BY lang, (source = 'wikidata') DESC, source", [req.params.id])).rows.map((n) => [n.lang, n.name]));
    const xrefs = (await pool.query('SELECT scheme, value, source FROM entity_xrefs WHERE entity_id = $1 AND value IS NOT NULL', [req.params.id])).rows;
    return { ...r.rows[0], names, xrefs, links };
  });

  /**
   * Confirm or dismiss a successor suggestion (admin). Accepting writes entity_successors rows for every target;
   * the review item is closed either way. Other kinds of review items are resolved with `dismiss` only.
   */
  app.post<{ Params: { id: string }; Body: { action?: string } }>('/v1/review-items/:id/resolve', { preHandler: requireAdmin }, async (req, reply) => {
    const action = req.body?.action;
    if (action !== 'accept' && action !== 'dismiss') return reply.code(400).send({ error: "action must be 'accept' or 'dismiss'" });
    const item = (await pool.query("SELECT id, entity_id, field, b_value FROM review_items WHERE id = $1 AND status = 'open'", [req.params.id])).rows[0];
    if (!item) return reply.code(404).send({ error: 'not_found_or_closed' });
    if (action === 'accept') {
      const m = /^successor:(replaced_by|merged_into|split_into)$/.exec(item.field);
      if (!m) return reply.code(400).send({ error: 'only successor suggestions can be accepted' });
      for (const t of (item.b_value?.to ?? []) as { id: string }[]) {
        await pool.query(
          `INSERT INTO entity_successors (old_id, new_id, relation, confidence, method, snapshot_id) VALUES ($1, $2, $3, $4, 'suggested+confirmed', $5)
           ON CONFLICT (old_id, new_id) DO NOTHING`,
          [item.entity_id, t.id, m[1], item.b_value?.confidence ?? 1, item.b_value?.snapshot_id ?? null],
        );
      }
    }
    await pool.query('UPDATE review_items SET status = $2 WHERE id = $1', [item.id, action === 'accept' ? 'accepted_b' : 'dismissed']);
    return { ok: true, id: Number(item.id), status: action === 'accept' ? 'accepted_b' : 'dismissed' };
  });

  /** Confirmed successors of a unit (it was replaced / merged) and predecessors (units it replaced); works for ids that no longer exist. */
  app.get<{ Params: { id: string } }>('/v1/regions/:id/successors', async (req) => ({
    successors: (await pool.query('SELECT new_id AS id, relation, confidence, confirmed_at FROM entity_successors WHERE old_id = $1 ORDER BY new_id', [req.params.id])).rows,
    predecessors: (await pool.query('SELECT old_id AS id, relation, confidence, confirmed_at FROM entity_successors WHERE new_id = $1 ORDER BY old_id', [req.params.id])).rows,
  }));

  app.get<{ Querystring: { status?: string; limit?: string } }>('/v1/review-items', { preHandler: requireAdmin }, async (req) => ({
    data: (
      await pool.query('SELECT id, entity_id, field, a_source, a_value, b_source, b_value, status, created_at FROM review_items WHERE status = $1 ORDER BY id LIMIT $2', [
        req.query.status ?? 'open',
        page(req.query).limit,
      ])
    ).rows,
  }));

  app.get<{ Params: { id: string }; Querystring: { limit?: string; after?: string; official_only?: string; canonical?: string } }>('/v1/regions/:id/children', async (req) => {
    const { limit, after } = page(req.query);
    const rows = (await pool.query(`SELECT ${COLS} FROM entities WHERE parent_id = $1 AND id > $2 ${officialOnly(req.query)} ORDER BY id LIMIT $3`, [req.params.id, after, limit + 1])).rows;
    return paged(rows, limit, 'id');
  });

  app.get<{ Querystring: { q?: string; country?: string; kind?: string; limit?: string; official_only?: string; canonical?: string } }>('/v1/search', async (req, reply) => {
    const q = (req.query.q ?? '').trim();
    if (q.length < 2) return reply.code(400).send({ error: 'q must be at least 2 characters' });
    const { limit } = page(req.query);
    const esc = q.toLowerCase().replace(/[\\%_]/g, '\\$&');
    const rows = (
      await pool.query(
        `SELECT ${COLS} FROM entities WHERE lower(name) LIKE $1 || '%' AND ($2::text IS NULL OR country_code = $2) AND ($3::text IS NULL OR kind = $3) ${officialOnly(req.query)}
         ORDER BY kind, name LIMIT $4`,
        [esc, req.query.country?.toUpperCase() ?? null, req.query.kind ?? null, limit],
      )
    ).rows;
    return { data: rows };
  });

  /** Where data comes from, under which license, and the credit line to show when redistributing it. */
  app.get('/v1/sources', async () => ({
    data: (
      await pool.query(
        `SELECT id, authority, url, license, version, attribution, retrieved_at, source_class, cadence, status, last_checked_at, last_changed_at, next_due_at,
                license_verdict, commercial_use, license_checked_at,
                (next_due_at IS NOT NULL AND next_due_at < now() - interval '2 days') AS stale
         FROM sources ORDER BY id`,
      )
    ).rows,
  }));

  /** Freshness summary for monitoring: anything stale, failed, awaiting review or with a changed license page. */
  app.get('/v1/status', async () => {
    const rows = (
      await pool.query(
        `SELECT id, status, next_due_at, last_checked_at, (next_due_at IS NOT NULL AND next_due_at < now() - interval '2 days') AS stale FROM sources ORDER BY id`,
      )
    ).rows;
    const attention = rows.filter((r) => r.status !== 'ok' || r.stale).map((r) => ({ id: r.id, status: r.status, stale: r.stale }));
    const lastRun = (await pool.query('SELECT source_id, status, finished_at FROM source_runs ORDER BY id DESC LIMIT 1')).rows[0] ?? null;
    const review = (await pool.query("SELECT count(*)::int AS n, count(*) FILTER (WHERE field LIKE 'successor:%')::int AS successors FROM review_items WHERE status = 'open'")).rows[0];
    return { ok: attention.length === 0, sources: rows.length, attention, last_run: lastRun, open_review_items: review.n, open_successor_suggestions: review.successors };
  });

  // ---- snapshots & deltas ---------------------------------------------
  app.get('/v1/snapshots', async () => ({
    data: (await pool.query('SELECT id, source, started_at, finished_at, from_seq, to_seq, inserted, updated, deleted, unchanged FROM snapshots ORDER BY id DESC LIMIT 100')).rows,
  }));

  /**
   * Cursor-based delta feed: everything after `since` (a seq from a previous
   * response's `next_seq`; 0 = from the start), oldest first.
   */
  app.get<{ Querystring: { since?: string; until?: string; country?: string; kind?: string; limit?: string } }>('/v1/changes', async (req) => {
    const since = Number(req.query.since ?? 0) || 0;
    const until = req.query.until ? Number(req.query.until) : null;
    const countries = req.query.country ? req.query.country.toUpperCase().split(',') : null;
    const { limit } = page(req.query);
    const rows = (
      await pool.query(
        `SELECT seq, snapshot_id, entity_id, kind, country_code::text AS country_code, op, changed_fields, before, after FROM changes
         WHERE seq > $1 AND ($2::bigint IS NULL OR seq <= $2) AND ($3::text[] IS NULL OR country_code = ANY($3)) AND ($4::text IS NULL OR kind = $4)
         ORDER BY seq LIMIT $5`,
        [since, until, countries, req.query.kind ?? null, limit + 1],
      )
    ).rows;
    const more = rows.length > limit;
    const data = more ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    const head = Number((await pool.query('SELECT COALESCE(max(seq),0) AS s FROM changes')).rows[0].s);
    return { data, has_more: more, next_seq: last ? Number(last.seq) : since, head_seq: head };
  });

  // ---- API keys (admin) ------------------------------------------------
  app.post<{ Body: { name?: string; rate_per_min?: number; export_profile?: string; export_countries?: string[] } }>('/v1/api-keys', { preHandler: requireAdmin }, async (req, reply) => {
    const name = req.body?.name?.trim();
    if (!name) return reply.code(400).send({ error: 'name is required' });
    const rate = req.body.rate_per_min;
    if (rate !== undefined && (!Number.isInteger(rate) || rate < 0)) return reply.code(400).send({ error: 'rate_per_min must be a non-negative integer (0 = unlimited)' });
    const profile = req.body.export_profile ?? 'commercial';
    if (!PROFILES.includes(profile as Profile)) return reply.code(400).send({ error: `export_profile must be one of ${PROFILES.join(', ')}` });
    const ec = req.body.export_countries?.map((c) => String(c).toUpperCase()) ?? null;
    if (ec && (ec.length === 0 || ec.some((c) => !/^[A-Z]{2}$/.test(c)))) return reply.code(400).send({ error: 'export_countries must be a non-empty list of ISO alpha-2 codes' });
    const key = `ci_${randomBytes(24).toString('hex')}`;
    const row = (await pool.query('INSERT INTO api_keys (name, key_hash, rate_per_min, export_profile, export_countries) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, rate_per_min, export_profile, export_countries, created_at', [name, sha(key), rate ?? null, profile, ec])).rows[0];
    return reply.code(201).send({ ...row, id: Number(row.id), key }); // the key is shown only here
  });
  app.get('/v1/api-keys', { preHandler: requireAdmin }, async () => ({
    data: (await pool.query('SELECT id, name, rate_per_min, export_profile, export_countries, active, created_at, last_used_at FROM api_keys ORDER BY id')).rows,
  }));
  app.get<{ Querystring: { from?: string; to?: string } }>('/v1/api-keys/usage', { preHandler: requireAdmin }, async (req) => {
    await flushUsage();
    return {
      data: (
        await pool.query(
          `SELECT u.day, u.key_id, k.name, u.requests FROM api_usage u LEFT JOIN api_keys k ON k.id = u.key_id
           WHERE ($1::date IS NULL OR u.day >= $1) AND ($2::date IS NULL OR u.day <= $2) ORDER BY u.day, u.key_id`,
          [req.query.from ?? null, req.query.to ?? null],
        )
      ).rows.map((r) => ({ ...r, key_id: Number(r.key_id), requests: Number(r.requests) })),
    };
  });
  app.delete<{ Params: { id: string } }>('/v1/api-keys/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const r = await pool.query('UPDATE api_keys SET active = false WHERE id = $1 AND active RETURNING key_hash', [req.params.id]);
    if (!r.rowCount) return reply.code(404).send({ error: 'not_found' });
    keyCache.delete(r.rows[0].key_hash);
    return { ok: true };
  });

  // ---- webhooks (admin, or a customer's own via its database API key) --------
  // Admin (Bearer ADMIN_TOKEN) sees and manages all subscriptions; a database API key only its own. Env keys have no identity and cannot own any.
  const who = (req: { headers: Record<string, unknown>; apiKeyId?: string }): { admin: boolean; keyId: number | null } | null => {
    if (adminToken && req.headers['authorization'] === `Bearer ${adminToken}`) return { admin: true, keyId: null };
    if (req.apiKeyId?.startsWith('dbkey:')) return { admin: false, keyId: Number(req.apiKeyId.slice(6)) };
    return null;
  };
  type Who = NonNullable<ReturnType<typeof who>>;
  /** Subscription id the caller may touch, or null. */
  const ownSub = async (w: Who, id: string): Promise<boolean> =>
    /^\d+$/.test(id) && !!(await pool.query('SELECT 1 FROM webhook_subscriptions WHERE id = $1 AND ($2::boolean OR api_key_id = $3)', [id, w.admin, w.keyId])).rowCount;

  app.post<{ Body: { url?: string; countries?: string[]; kinds?: string[]; events?: string[]; api_key_id?: number } }>('/v1/webhooks', async (req, reply) => {
    const w = who(req);
    if (!w) return reply.code(401).send({ error: 'unauthorized' });
    const url = req.body?.url ?? '';
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    } catch {
      return reply.code(400).send({ error: 'url must be a valid http(s) URL' });
    }
    const events = req.body.events ?? null;
    if (events && (events.length === 0 || events.some((e) => !(WEBHOOK_EVENTS as readonly string[]).includes(e)))) {
      return reply.code(400).send({ error: `events must be a non-empty subset of ${WEBHOOK_EVENTS.join(', ')}` });
    }
    const countries = req.body.countries?.map((c) => c.toUpperCase()) ?? null;
    const kinds = req.body.kinds ?? null;
    const secret = randomBytes(24).toString('hex');
    const owner = w.admin ? (req.body.api_key_id ?? null) : w.keyId;
    const r = await pool.query('INSERT INTO webhook_subscriptions (url, secret, countries, kinds, events, api_key_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, url, countries, kinds, events, active', [url, secret, countries, kinds, events, owner]);
    return reply.code(201).send({ ...r.rows[0], secret }); // secret is shown only here
  });

  app.get('/v1/webhooks', async (req, reply) => {
    const w = who(req);
    if (!w) return reply.code(401).send({ error: 'unauthorized' });
    return { data: (await pool.query('SELECT id, url, countries, kinds, events, active, api_key_id, created_at FROM webhook_subscriptions WHERE $1::boolean OR api_key_id = $2 ORDER BY id', [w.admin, w.keyId])).rows };
  });

  app.delete<{ Params: { id: string } }>('/v1/webhooks/:id', async (req, reply) => {
    const w = who(req);
    if (!w) return reply.code(401).send({ error: 'unauthorized' });
    if (!(await ownSub(w, req.params.id))) return reply.code(404).send({ error: 'not_found' });
    await pool.query('DELETE FROM webhook_subscriptions WHERE id = $1', [req.params.id]);
    return reply.code(204).send();
  });

  /** Delivery log of one subscription, newest first (so a customer can see what was sent and what failed). */
  app.get<{ Params: { id: string }; Querystring: { limit?: string; before?: string; status?: string } }>('/v1/webhooks/:id/deliveries', async (req, reply) => {
    const w = who(req);
    if (!w) return reply.code(401).send({ error: 'unauthorized' });
    if (!(await ownSub(w, req.params.id))) return reply.code(404).send({ error: 'not_found' });
    const limit = Math.min(Math.max(parseInt(req.query.limit ?? '50', 10) || 50, 1), 200);
    const before = /^\d+$/.test(req.query.before ?? '') ? req.query.before! : '9223372036854775807';
    const rows = (
      await pool.query(
        `SELECT id, event, snapshot_id, status, attempts, last_error, created_at, delivered_at, next_attempt_at, payload
         FROM webhook_deliveries WHERE subscription_id = $1 AND id < $2 AND ($3::text IS NULL OR status = $3) ORDER BY id DESC LIMIT $4`,
        [req.params.id, before, req.query.status ?? null, limit + 1],
      )
    ).rows;
    const more = rows.length > limit;
    const data = more ? rows.slice(0, limit) : rows;
    return { data, has_more: more, next_before: more ? data[data.length - 1]!.id : null };
  });

  /** Send a delivery again (a copy, so the original stays in the log). Use after a failed or lost delivery. */
  app.post<{ Params: { id: string; did: string } }>('/v1/webhooks/:id/deliveries/:did/replay', async (req, reply) => {
    const w = who(req);
    if (!w) return reply.code(401).send({ error: 'unauthorized' });
    if (!(await ownSub(w, req.params.id)) || !/^\d+$/.test(req.params.did)) return reply.code(404).send({ error: 'not_found' });
    const r = await pool.query(
      `INSERT INTO webhook_deliveries (subscription_id, snapshot_id, payload, event)
       SELECT subscription_id, snapshot_id, payload, event FROM webhook_deliveries WHERE id = $1 AND subscription_id = $2 RETURNING id`,
      [req.params.did, req.params.id],
    );
    return r.rowCount ? reply.code(202).send({ id: r.rows[0].id, status: 'pending' }) : reply.code(404).send({ error: 'not_found' });
  });

  /** Queue a `webhook.test` event so a new endpoint can be checked before real data arrives. */
  app.post<{ Params: { id: string } }>('/v1/webhooks/:id/test', async (req, reply) => {
    const w = who(req);
    if (!w) return reply.code(401).send({ error: 'unauthorized' });
    if (!(await ownSub(w, req.params.id))) return reply.code(404).send({ error: 'not_found' });
    const r = await pool.query("INSERT INTO webhook_deliveries (subscription_id, payload, event) VALUES ($1, $2, 'webhook.test') RETURNING id", [req.params.id, JSON.stringify({ event: 'webhook.test', sent_at: new Date().toISOString() })]);
    return reply.code(202).send({ id: r.rows[0].id, status: 'pending' });
  });

  // ---- release notes ---------------------------------------------------
  app.get<{ Querystring: { limit?: string; before?: string } }>('/v1/releases', async (req) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit ?? '30', 10) || 30, 1), 100);
    const before = /^\d+$/.test(req.query.before ?? '') ? req.query.before! : '9223372036854775807';
    const rows = (await pool.query('SELECT id, snapshot_id, kind, source_id, vintage, reason, title, totals, countries, highlight, retracted, created_at FROM release_notes WHERE public AND id < $1 ORDER BY id DESC LIMIT $2', [before, limit + 1])).rows;
    const more = rows.length > limit;
    const data = more ? rows.slice(0, limit) : rows;
    return { data, has_more: more, next_before: more ? data[data.length - 1]!.id : null };
  });
  /** Atom feed of the latest customer-visible release notes (for feed readers; sent with the API key like any /v1 call). */
  app.get('/v1/releases.atom', async (_req, reply) => {
    const rows = (await pool.query('SELECT id, title, body_md, retracted, created_at FROM release_notes WHERE public ORDER BY id DESC LIMIT 50')).rows;
    const esc = (x: string) => x.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
    const updated = new Date(rows[0]?.created_at ?? 0).toISOString();
    const base = config.publicBaseUrl.replace(/\/$/, '');
    const entries = rows.map((r) => `  <entry>
    <id>tag:country-info,2026:release:${r.id}</id>
    <title>${esc((r.retracted ? '[retracted] ' : '') + r.title)}</title>
    <updated>${new Date(r.created_at).toISOString()}</updated>
    <link href="${esc(`${base}/v1/releases/${r.id}`)}"/>
    <content type="text">${esc(r.body_md)}</content>
  </entry>`).join('\n');
    return reply.header('content-type', 'application/atom+xml; charset=utf-8').send(`<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>tag:country-info,2026:releases</id>
  <title>country-info release notes</title>
  <updated>${updated}</updated>
  <link rel="self" href="${esc(`${base}/v1/releases.atom`)}"/>
${entries}
</feed>
`);
  });
  app.get<{ Params: { id: string } }>('/v1/releases/:id', async (req, reply) => {
    const r = /^\d+$/.test(req.params.id) ? await pool.query('SELECT id, snapshot_id, kind, source_id, vintage, reason, title, body_md, totals, countries, highlight, retracted, created_at FROM release_notes WHERE public AND id = $1', [req.params.id]) : null;
    return r?.rows[0] ?? reply.code(404).send({ error: 'not_found' });
  });
  app.post<{ Body: { email?: string; frequency?: string } }>('/v1/release-subscribers', { preHandler: requireAdmin }, async (req, reply) => {
    const email = req.body?.email?.trim().toLowerCase() ?? '';
    const frequency = req.body?.frequency ?? 'weekly';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply.code(400).send({ error: 'a valid email is required' });
    if (frequency !== 'instant' && frequency !== 'weekly') return reply.code(400).send({ error: 'frequency must be instant or weekly' });
    // A new subscriber starts after the existing notes: no flood of history.
    const r = await pool.query(
      `INSERT INTO release_subscribers (email, frequency, last_sent_note_id) VALUES ($1, $2, coalesce((SELECT max(id) FROM release_notes), 0))
       ON CONFLICT (email) DO UPDATE SET frequency = $2, active = true RETURNING id, email, frequency, active`,
      [email, frequency],
    );
    return reply.code(201).send(r.rows[0]);
  });
  app.get('/v1/release-subscribers', { preHandler: requireAdmin }, async () => ({ data: (await pool.query('SELECT id, email, frequency, active, last_sent_at, created_at FROM release_subscribers ORDER BY id')).rows }));
  app.delete<{ Params: { id: string } }>('/v1/release-subscribers/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const r = /^\d+$/.test(req.params.id) ? await pool.query('DELETE FROM release_subscribers WHERE id = $1', [req.params.id]) : null;
    return r?.rowCount ? reply.code(204).send() : reply.code(404).send({ error: 'not_found' });
  });

  // ---- published file bundles ------------------------------------------


  // ---- scopes, metadata and composed profiles ------------------------------------
  // `scopes` (csv) picks slices of country information from the catalog (src/scopes/catalog.ts); `mode=intersect` keeps only what every
  // requested country has, `union` (default) everything. A named profile (own, per API key) stores such a selection.
  const MAX_PROFILE_COUNTRIES = 50;
  const csv = (v?: string): string[] => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
  type SelQuery = { limit?: string; countries?: string; scopes?: string; mode?: string; locale?: string; level?: string; year?: string; region?: string; profile?: string };
  /** Selection from the query, completed by the named profile (explicit query parameters win), or an error message. */
  const selection = async (q: SelQuery, w: ReturnType<typeof who>, keyId: string | undefined, pathCountry?: string): Promise<{ countries: string[]; scopes: string[]; mode: Mode; locale?: string; level?: 1 | 2; year?: number; region?: string; limit?: number } | { error: string }> => {
    let prof: { scopes: string[]; countries: string[] | null; mode: Mode; locale: string | null } | undefined;
    const name = q.profile ?? (keyId?.startsWith('dbkey:') ? (await pool.query('SELECT default_profile FROM api_keys WHERE id = $1', [keyId.slice(6)])).rows[0]?.default_profile : undefined);
    if (name) {
      const owner = w?.admin ? null : keyId?.startsWith('dbkey:') ? Number(keyId.slice(6)) : null;
      prof = (await pool.query('SELECT scopes, countries, mode, locale FROM scope_profiles WHERE name = $1 AND api_key_id IS NOT DISTINCT FROM $2', [name, owner])).rows[0];
      if (!prof && q.profile) return { error: `unknown profile ${q.profile}` };
    }
    const countries = pathCountry ? [pathCountry.toUpperCase()] : csv(q.countries).length ? csv(q.countries).map((c) => c.toUpperCase()) : (prof?.countries ?? []);
    if (!countries.length) return { error: 'countries is required (comma-separated ISO codes) unless the profile lists them' };
    if (countries.length > MAX_PROFILE_COUNTRIES) return { error: `at most ${MAX_PROFILE_COUNTRIES} countries per request` };
    const scopes = csv(q.scopes).length ? csv(q.scopes) : (prof?.scopes ?? DEFAULT_SCOPES);
    const bad = validateScopes(scopes);
    if (bad) return { error: bad };
    const mode = (q.mode ?? prof?.mode ?? 'union') as Mode;
    if (mode !== 'union' && mode !== 'intersect') return { error: 'mode must be union or intersect' };
    if (q.level && q.level !== '1' && q.level !== '2') return { error: 'level must be 1 or 2' };
    const year = q.year ? Number(q.year) : undefined;
    if (year !== undefined && (!Number.isInteger(year) || year < 1900 || year > 2200)) return { error: 'invalid year' };
    return { countries, scopes, mode, locale: q.locale ?? prof?.locale ?? undefined, level: q.level ? (Number(q.level) as 1 | 2) : undefined, year, region: q.region, limit: q.limit && /^\d+$/.test(q.limit) ? Number(q.limit) : undefined };
  };
  const optsOf = (s: { locale?: string; level?: 1 | 2; year?: number; region?: string; limit?: number }) => ({ locale: s.locale, level: s.level, year: s.year, region: s.region, limit: s.limit });

  app.get('/v1/scopes', async () => ({ schema_version: SCHEMA_VERSION, default_scopes: DEFAULT_SCOPES, data: CATALOG.map((s) => ({ id: s.id, title: s.title, description: s.description, applies_to: s.applies_to, default: s.default, availability: s.availability, fields: s.fields.map((f) => f.path) })) }));
  app.get<{ Params: { id: string } }>('/v1/scopes/:id', async (req, reply) => {
    if (!scopeById(req.params.id)) return reply.code(404).send({ error: 'not_found' });
    const doc = (await catalogDocument(pool)) as { scopes: Record<string, unknown> };
    return { schema_version: SCHEMA_VERSION, id: req.params.id, ...(doc.scopes[req.params.id] as object) };
  });
  /** Global metadata (no `countries`): catalog with world coverage. With `countries`: only the fields those countries carry (`mode`). */
  app.get<{ Querystring: SelQuery }>('/v1/schema', async (req, reply) => {
    if (!req.query.countries) return globalSchema(pool);
    const sel = await selection(req.query, who(req), req.apiKeyId);
    if ('error' in sel) return reply.code(400).send({ error: sel.error });
    return schemaFor(pool, sel.countries, sel.scopes.length ? sel.scopes : DEFAULT_SCOPES, sel.mode, optsOf(sel));
  });
  app.get<{ Params: { code: string }; Querystring: SelQuery }>('/v1/schema/countries/:code', async (req, reply) => {
    const sel = await selection(req.query, who(req), req.apiKeyId, req.params.code);
    if ('error' in sel) return reply.code(400).send({ error: sel.error });
    const doc = await schemaFor(pool, sel.countries, req.query.scopes || req.query.profile ? sel.scopes : CATALOG.map((s) => s.id), 'union', optsOf(sel));
    return doc.countries.length ? doc : reply.code(404).send({ error: 'not_found' });
  });
  app.get<{ Querystring: SelQuery }>('/v1/profile', async (req, reply) => {
    const sel = await selection(req.query, who(req), req.apiKeyId);
    if ('error' in sel) return reply.code(400).send({ error: sel.error });
    return composeProfile(pool, sel.countries, sel.scopes, sel.mode, optsOf(sel));
  });

  app.post<{ Body: { name?: string; scopes?: string[]; countries?: string[]; mode?: string; locale?: string; api_key_id?: number; default?: boolean } }>('/v1/scope-profiles', async (req, reply) => {
    const w = who(req);
    if (!w) return reply.code(401).send({ error: 'unauthorized' });
    const b = req.body ?? {};
    if (!b.name || !/^[\w.-]{1,64}$/.test(b.name)) return reply.code(400).send({ error: 'name must be 1-64 characters (letters, digits, _ . -)' });
    const scopes = b.scopes?.length ? b.scopes : DEFAULT_SCOPES;
    const bad = validateScopes(scopes);
    if (bad) return reply.code(400).send({ error: bad });
    if (b.mode && b.mode !== 'union' && b.mode !== 'intersect') return reply.code(400).send({ error: 'mode must be union or intersect' });
    if ((b.countries?.length ?? 0) > MAX_PROFILE_COUNTRIES) return reply.code(400).send({ error: `at most ${MAX_PROFILE_COUNTRIES} countries` });
    const owner = w.admin ? (b.api_key_id ?? null) : w.keyId;
    try {
      const r = await pool.query('INSERT INTO scope_profiles (api_key_id, name, scopes, countries, mode, locale) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, api_key_id, name, scopes, countries, mode, locale, created_at', [owner, b.name, scopes, b.countries?.map((c) => c.toUpperCase()) ?? null, b.mode ?? 'union', b.locale ?? null]);
      if (b.default && owner !== null) await pool.query('UPDATE api_keys SET default_profile = $1 WHERE id = $2', [b.name, owner]);
      return reply.code(201).send(r.rows[0]);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') return reply.code(409).send({ error: 'a profile with this name already exists' });
      throw e;
    }
  });
  app.get('/v1/scope-profiles', async (req, reply) => {
    const w = who(req);
    if (!w) return reply.code(401).send({ error: 'unauthorized' });
    return { data: (await pool.query('SELECT id, api_key_id, name, scopes, countries, mode, locale, created_at FROM scope_profiles WHERE $1::boolean OR api_key_id = $2 ORDER BY id', [w.admin, w.keyId])).rows };
  });
  app.delete<{ Params: { id: string } }>('/v1/scope-profiles/:id', async (req, reply) => {
    const w = who(req);
    if (!w) return reply.code(401).send({ error: 'unauthorized' });
    if (!/^\d+$/.test(req.params.id)) return reply.code(404).send({ error: 'not_found' });
    const r = await pool.query('DELETE FROM scope_profiles WHERE id = $1 AND ($2::boolean OR api_key_id = $3) RETURNING name, api_key_id', [req.params.id, w.admin, w.keyId]);
    if (!r.rowCount) return reply.code(404).send({ error: 'not_found' });
    if (r.rows[0].api_key_id !== null) await pool.query('UPDATE api_keys SET default_profile = NULL WHERE id = $1 AND default_profile = $2', [r.rows[0].api_key_id, r.rows[0].name]);
    return reply.code(204).send();
  });

  const store = opts.store === undefined ? createStore() : opts.store;
  /** Latest bundle of the caller's profile (a database key's `export_profile`; env keys and admin get `commercial`, admin may ask `?profile=full`). */
  app.get<{ Querystring: { profile?: string; country?: string } }>('/v1/exports/latest', async (req, reply) => {
    if (!store) return reply.code(503).send({ error: 'exports_not_configured' });
    const w = who(req);
    let profile: Profile = 'commercial';
    let allowed: string[] | null = null;
    if (req.apiKeyId?.startsWith('dbkey:') && !w?.admin) {
      const k = (await pool.query('SELECT export_profile, export_countries FROM api_keys WHERE id = $1', [req.apiKeyId.slice(6)])).rows[0];
      profile = (k?.export_profile ?? 'commercial') as Profile;
      allowed = k?.export_countries ?? null;
    } else if (w?.admin && req.query.profile && PROFILES.includes(req.query.profile as Profile)) profile = req.query.profile as Profile;
    const links = await exportLinks(store, profile, { allowed, countries: req.query.country?.split(',').map((c) => c.trim()).filter(Boolean) });
    return links ?? reply.code(404).send({ error: 'nothing_published' });
  });
  // Signed, expiring downloads of the fs store (no API key: the signature is the credential). S3 stores presign their own URLs.
  if (store instanceof FsStore) {
    app.get<{ Params: { '*': string }; Querystring: { exp?: string; sig?: string } }>('/dl/*', async (req, reply) => {
      const key = req.params['*'];
      if (!store.verifyDownload(key, req.query.exp ?? '', req.query.sig ?? '')) return reply.code(403).send({ error: 'invalid_or_expired_link' });
      const path = store.localPath(key);
      if (!path || !(await stat(path).then((s) => s.isFile(), () => false))) return reply.code(404).send({ error: 'not_found' });
      return reply.header('content-type', contentTypeOf(key)).header('cache-control', 'private, max-age=60').send(createReadStream(path));
    });
  }

  // ---- exported files --------------------------------------------------
  const dir = resolve(opts.exportDir ?? config.exportDir);
  await mkdir(dir, { recursive: true });
  await app.register(fastifyStatic, { root: dir, prefix: '/files/' });

  return app;
}

function paged(rows: Record<string, unknown>[], limit: number, key: string) {
  const more = rows.length > limit;
  const data = more ? rows.slice(0, limit) : rows;
  return { data, has_more: more, next_after: more ? data[data.length - 1]![key] : null };
}
