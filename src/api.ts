import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type pg from 'pg';
import { config } from './config.js';
import { installAccessControl } from './access.js';

import { openApiSpec } from './openapi.js';

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

export async function buildApp(pool: pg.Pool, opts: { adminToken?: string; exportDir?: string; apiKeys?: string[]; rateLimitPerMin?: number; requireApiKey?: boolean } = {}): Promise<FastifyInstance> {
  const adminToken = opts.adminToken ?? config.adminToken;
  const app = Fastify({ logger: false });
  const routes = new Set<string>();
  app.addHook('onRoute', (r) => { for (const m of [r.method].flat()) if (m !== 'HEAD' && m !== 'OPTIONS') routes.add(`${m.toLowerCase()} ${r.url}`); });
  app.decorate('routeList', routes);
  const keyCache = new Map<string, { at: number; v: { id: string; ratePerMin: number | null } | null }>();
  const sha = (k: string) => createHash('sha256').update(k).digest('hex');
  installAccessControl(app, {
    apiKeys: opts.apiKeys ?? config.apiKeys, perWindow: opts.rateLimitPerMin ?? config.rateLimitPerMin, adminToken, requireKey: opts.requireApiKey ?? config.requireApiKey,
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
        `SELECT ${COLS} FROM entities WHERE kind = 'country' AND code > $1
           AND ($2::text IS NULL OR data->>'un_status' = $2) AND ($3::text IS NULL OR data->>'continent' = $3)
         ORDER BY code LIMIT $4`,
        [after, un_status ?? null, continent ?? null, limit + 1],
      )
    ).rows;
    return paged(rows, limit, 'code');
  });

  app.get<{ Params: { code: string } }>('/v1/countries/:code', async (req, reply) => {
    const r = await pool.query(`SELECT ${COLS} FROM entities WHERE kind = 'country' AND code = $1`, [req.params.code.toUpperCase()]);
    if (!r.rows[0]) return reply.code(404).send({ error: 'not_found' });
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
    return { ok: attention.length === 0, sources: rows.length, attention, last_run: lastRun };
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
  app.post<{ Body: { name?: string; rate_per_min?: number } }>('/v1/api-keys', { preHandler: requireAdmin }, async (req, reply) => {
    const name = req.body?.name?.trim();
    if (!name) return reply.code(400).send({ error: 'name is required' });
    const rate = req.body.rate_per_min;
    if (rate !== undefined && (!Number.isInteger(rate) || rate < 0)) return reply.code(400).send({ error: 'rate_per_min must be a non-negative integer (0 = unlimited)' });
    const key = `ci_${randomBytes(24).toString('hex')}`;
    const row = (await pool.query('INSERT INTO api_keys (name, key_hash, rate_per_min) VALUES ($1, $2, $3) RETURNING id, name, rate_per_min, created_at', [name, sha(key), rate ?? null])).rows[0];
    return reply.code(201).send({ ...row, id: Number(row.id), key }); // the key is shown only here
  });
  app.get('/v1/api-keys', { preHandler: requireAdmin }, async () => ({
    data: (await pool.query('SELECT id, name, rate_per_min, active, created_at, last_used_at FROM api_keys ORDER BY id')).rows,
  }));
  app.delete<{ Params: { id: string } }>('/v1/api-keys/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const r = await pool.query('UPDATE api_keys SET active = false WHERE id = $1 AND active RETURNING key_hash', [req.params.id]);
    if (!r.rowCount) return reply.code(404).send({ error: 'not_found' });
    keyCache.delete(r.rows[0].key_hash);
    return { ok: true };
  });

  // ---- webhooks (admin) -----------------------------------------------
  app.post<{ Body: { url?: string; countries?: string[]; kinds?: string[] } }>('/v1/webhooks', { preHandler: requireAdmin }, async (req, reply) => {
    const url = req.body?.url ?? '';
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    } catch {
      return reply.code(400).send({ error: 'url must be a valid http(s) URL' });
    }
    const countries = req.body.countries?.map((c) => c.toUpperCase()) ?? null;
    const kinds = req.body.kinds ?? null;
    const secret = randomBytes(24).toString('hex');
    const r = await pool.query('INSERT INTO webhook_subscriptions (url, secret, countries, kinds) VALUES ($1, $2, $3, $4) RETURNING id, url, countries, kinds, active', [url, secret, countries, kinds]);
    return reply.code(201).send({ ...r.rows[0], secret }); // secret is shown only here
  });

  app.get('/v1/webhooks', { preHandler: requireAdmin }, async () => ({
    data: (await pool.query('SELECT id, url, countries, kinds, active, created_at FROM webhook_subscriptions ORDER BY id')).rows,
  }));

  app.delete<{ Params: { id: string } }>('/v1/webhooks/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const r = await pool.query('DELETE FROM webhook_subscriptions WHERE id = $1', [req.params.id]);
    return r.rowCount ? reply.code(204).send() : reply.code(404).send({ error: 'not_found' });
  });

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
