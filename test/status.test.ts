import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/api.js';
import { migrate } from '../src/db.js';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('/v1/status quality fields', () => {
  const pool = new pg.Pool({ connectionString: url });
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    await migrate(pool);
    app = await buildApp(pool, { adminToken: 't', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
  });
  afterAll(async () => { await app.close(); await pool.end(); });
  const ent = (id: string, parent: string | null, src: string) => pool.query(`INSERT INTO entities (id, kind, parent_id, country_code, code, name, data, content_hash, updated_seq, source_id) VALUES ($1, 'division', $2, 'DE', $1, $1, '{}', 'h', 0, $3)`, [id, parent, src]);

  it('reports rows against the band and flags out-of-band sources', async () => {
    await pool.query('TRUNCATE entities, sources RESTART IDENTITY CASCADE');
    const src = (id: string, min: number | null, max: number | null) => pool.query(`INSERT INTO sources (id, authority, url, license, attribution, expected_min, expected_max, next_due_at) VALUES ($1, 'a', 'u', 'l', 'x', $2, $3, now() + interval '1 day')`, [id, min, max]);
    await src('ok-src', 2, 5);
    await src('small-src', 10, 20);
    await src('enrich-only', 0, 0); // no rows expected and none loaded: not listed
    await ent('a', null, 'ok-src');
    await ent('b', 'a', 'ok-src');
    await ent('c', null, 'small-src');
    await ent('d', 'c', 'small-src');
    await src('never-loaded', 5, 9); // zero rows: left to its status, not flagged as out of band
    const st = (await app.inject('/v1/status')).json();
    const by = Object.fromEntries(st.sources_detail.map((d: { id: string }) => [d.id, d]));
    expect(by['ok-src']).toMatchObject({ rows: 2, in_band: true, expected: [2, 5] });
    expect(by['small-src']).toMatchObject({ rows: 2, in_band: false });
    expect(by['enrich-only']).toBeUndefined();
    expect(st.ok).toBe(false);
    expect(st.attention).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'small-src', status: 'out_of_band', rows: 2, expected: [10, 20] }),
    ]));
    expect(st.attention.some((a: { id: string }) => a.id === 'ok-src' || a.id === 'never-loaded')).toBe(false);
  });
});
