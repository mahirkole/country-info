import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type pg from 'pg';
import { config } from './config.js';

const COLS = 'id, kind, parent_id, country_code::text AS country_code, code, name, name_ascii, lat, lon, data, source_id, updated_seq';
const MAX_LIMIT = 1000;

function page(q: { limit?: string; after?: string }) {
  const limit = Math.min(Math.max(parseInt(q.limit ?? '100', 10) || 100, 1), MAX_LIMIT);
  return { limit, after: q.after ?? '' };
}

export async function buildApp(pool: pg.Pool, opts: { adminToken?: string; exportDir?: string } = {}): Promise<FastifyInstance> {
  const adminToken = opts.adminToken ?? config.adminToken;
  const app = Fastify({ logger: false });

  const requireAdmin = async (req: { headers: Record<string, unknown> }, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) => {
    if (!adminToken || req.headers['authorization'] !== `Bearer ${adminToken}`) return reply.code(401).send({ error: 'unauthorized' });
  };

  app.get('/healthz', async () => ({ ok: true }));

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
    return r.rows[0] ?? reply.code(404).send({ error: 'not_found' });
  });

  app.get<{ Params: { code: string }; Querystring: { level?: string; limit?: string; after?: string } }>(
    '/v1/countries/:code/regions',
    async (req, reply) => {
      const cc = req.params.code.toUpperCase();
      const kind = req.query.level === '2' ? 'admin2' : req.query.level === '1' || !req.query.level ? 'admin1' : null;
      if (!kind) return reply.code(400).send({ error: 'level must be 1 or 2' });
      const { limit, after } = page(req.query);
      const rows = (
        await pool.query(`SELECT ${COLS} FROM entities WHERE country_code = $1 AND kind = $2 AND id > $3 ORDER BY id LIMIT $4`, [cc, kind, after, limit + 1])
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
  app.get<{ Params: { code: string }; Querystring: { level?: string; type?: string; source?: string; limit?: string; after?: string } }>(
    '/v1/countries/:code/divisions',
    async (req) => {
      const { limit, after } = page(req.query);
      const rows = (
        await pool.query(
          `SELECT ${COLS} FROM entities WHERE kind = 'division' AND country_code = $1 AND id > $2
             AND ($3::text IS NULL OR source_id = $3) AND ($4::int IS NULL OR (data->>'level')::int = $4) AND ($5::text IS NULL OR data->>'type' = $5)
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
    return { ...r.rows[0], links };
  });

  app.get<{ Querystring: { status?: string; limit?: string } }>('/v1/review-items', { preHandler: requireAdmin }, async (req) => ({
    data: (
      await pool.query('SELECT id, entity_id, field, a_source, a_value, b_source, b_value, status, created_at FROM review_items WHERE status = $1 ORDER BY id LIMIT $2', [
        req.query.status ?? 'open',
        page(req.query).limit,
      ])
    ).rows,
  }));

  app.get<{ Params: { id: string }; Querystring: { limit?: string; after?: string } }>('/v1/regions/:id/children', async (req) => {
    const { limit, after } = page(req.query);
    const rows = (await pool.query(`SELECT ${COLS} FROM entities WHERE parent_id = $1 AND id > $2 ORDER BY id LIMIT $3`, [req.params.id, after, limit + 1])).rows;
    return paged(rows, limit, 'id');
  });

  app.get<{ Querystring: { q?: string; country?: string; kind?: string; limit?: string } }>('/v1/search', async (req, reply) => {
    const q = (req.query.q ?? '').trim();
    if (q.length < 2) return reply.code(400).send({ error: 'q must be at least 2 characters' });
    const { limit } = page(req.query);
    const esc = q.toLowerCase().replace(/[\\%_]/g, '\\$&');
    const rows = (
      await pool.query(
        `SELECT ${COLS} FROM entities WHERE lower(name) LIKE $1 || '%' AND ($2::text IS NULL OR country_code = $2) AND ($3::text IS NULL OR kind = $3)
         ORDER BY kind, name LIMIT $4`,
        [esc, req.query.country?.toUpperCase() ?? null, req.query.kind ?? null, limit],
      )
    ).rows;
    return { data: rows };
  });

  /** Where data comes from, under which license, and the credit line to show when redistributing it. */
  app.get('/v1/sources', async () => ({
    data: (await pool.query('SELECT id, authority, url, license, version, attribution, retrieved_at FROM sources ORDER BY id')).rows,
  }));

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
