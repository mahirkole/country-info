import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../src/db.js';
import { ingest } from '../src/ingest.js';
import { buildApp } from '../src/api.js';
import { processDeliveries, sign } from '../src/webhooks.js';
import { exportSnapshot } from '../src/export.js';
import type { EntityInput } from '../src/model.js';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

const E = (id: string, kind: EntityInput['kind'], cc: string, name: string, parent: string | null, data = {}): EntityInput =>
  ({ id, kind, parent_id: parent, country_code: cc, code: id.split(':')[1]!, name, name_ascii: null, lat: null, lon: null, data });
const KINDS = ['country', 'admin1', 'admin2'];
const v1 = [
  E('country:TR', 'country', 'TR', 'Turkey', null, { population: 1 }),
  E('country:DE', 'country', 'DE', 'Germany', null),
  E('gn:1', 'admin1', 'TR', 'Istanbul', 'country:TR'),
  E('gn:2', 'admin2', 'TR', 'Fatih', 'gn:1'),
];

d('database', () => {
  let pool: pg.Pool;
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrate(pool);
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE webhook_deliveries, webhook_subscriptions, changes, snapshots, entities RESTART IDENTITY CASCADE');
  });
  afterAll(() => pool.end());

  it('first ingest inserts everything, second is a no-op', async () => {
    const r1 = await ingest(pool, 't', v1, KINDS);
    expect(r1).toMatchObject({ inserted: 4, updated: 0, deleted: 0, unchanged: 0 });
    const r2 = await ingest(pool, 't', v1, KINDS);
    expect(r2).toMatchObject({ inserted: 0, updated: 0, deleted: 0, unchanged: 4, fromSeq: r1.toSeq, toSeq: r1.toSeq });
  });

  it('records update and delete deltas with before/after', async () => {
    const r1 = await ingest(pool, 't', v1, KINDS);
    const v2 = [
      E('country:TR', 'country', 'TR', 'Türkiye', null, { population: 2 }),
      E('country:DE', 'country', 'DE', 'Germany', null),
      E('gn:1', 'admin1', 'TR', 'Istanbul', 'country:TR'),
      // gn:2 removed, gn:3 added
      E('gn:3', 'admin2', 'TR', 'Kadikoy', 'gn:1'),
    ];
    const r2 = await ingest(pool, 't', v2, KINDS);
    expect(r2).toMatchObject({ inserted: 1, updated: 1, deleted: 1, unchanged: 2, fromSeq: r1.toSeq });
    const ch = (await pool.query('SELECT * FROM changes WHERE snapshot_id = $1 ORDER BY seq', [r2.snapshotId])).rows;
    expect(ch.map((c) => `${c.op}:${c.entity_id}`)).toEqual(['insert:gn:3', 'update:country:TR', 'delete:gn:2']);
    expect(ch[1].changed_fields.sort()).toEqual(['data.population', 'name']);
    expect(ch[1].before.name).toBe('Turkey');
    expect(ch[2].before.name).toBe('Fatih');
    expect((await pool.query("SELECT count(*)::int n FROM entities")).rows[0].n).toBe(4);
  });

  it('is atomic: a bad source leaves nothing behind', async () => {
    await expect(ingest(pool, 't', [E('gn:9', 'admin1', 'TR', 'Orphan', 'country:NOPE')], KINDS)).rejects.toThrow();
    expect((await pool.query('SELECT count(*)::int n FROM snapshots')).rows[0].n).toBe(0);
  });

  it('serves countries, regions and cursor-based changes', async () => {
    await ingest(pool, 't', v1, KINDS);
    const app = await buildApp(pool, { adminToken: 'tok', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    const get = async (u: string) => (await app.inject(u)).json();
    expect((await get('/v1/countries/tr')).name).toBe('Turkey');
    expect((await get('/v1/countries/TR/regions?level=1')).data.map((r: { id: string }) => r.id)).toEqual(['gn:1']);
    expect((await get('/v1/regions/gn:1/children')).data.map((r: { id: string }) => r.id)).toEqual(['gn:2']);
    expect((await get('/v1/search?q=fat')).data[0].id).toBe('gn:2');
    const p1 = await get('/v1/changes?since=0&limit=3');
    expect(p1).toMatchObject({ has_more: true });
    const p2 = await get(`/v1/changes?since=${p1.next_seq}&limit=3`);
    expect(p2.data).toHaveLength(1);
    expect((await get('/v1/changes?country=DE')).data).toHaveLength(1);
    expect((await app.inject('/v1/countries/ZZ')).statusCode).toBe(404);
    await app.close();
  });

  it('protects webhook admin and delivers signed notifications with retry', async () => {
    const app = await buildApp(pool, { adminToken: 'tok', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    expect((await app.inject({ method: 'POST', url: '/v1/webhooks', payload: { url: 'https://x.test/h' } })).statusCode).toBe(401);
    const created = await app.inject({ method: 'POST', url: '/v1/webhooks', headers: { authorization: 'Bearer tok' }, payload: { url: 'https://x.test/h', countries: ['de'] } });
    expect(created.statusCode).toBe(201);
    const { secret } = created.json();

    await ingest(pool, 't', v1, KINDS);
    expect((await pool.query('SELECT count(*)::int n FROM webhook_deliveries')).rows[0].n).toBe(1);

    const calls: { body: string; headers: Record<string, string> }[] = [];
    let fail = true;
    const send = (async (_u: string, init: RequestInit) => {
      calls.push({ body: init.body as string, headers: init.headers as Record<string, string> });
      return new Response(null, { status: fail ? 500 : 200 });
    }) as unknown as typeof fetch;
    await processDeliveries(pool, send);
    expect((await pool.query('SELECT status, attempts FROM webhook_deliveries')).rows[0]).toMatchObject({ status: 'pending', attempts: 1 });
    await pool.query('UPDATE webhook_deliveries SET next_attempt_at = now()');
    fail = false;
    await processDeliveries(pool, send);
    expect((await pool.query('SELECT status FROM webhook_deliveries')).rows[0].status).toBe('delivered');

    const last = calls[1]!;
    expect(last.headers['x-countryinfo-signature']).toBe(sign(secret, last.body, last.headers['x-countryinfo-timestamp']!));
    expect(JSON.parse(last.body).changes_by_country).toEqual({ DE: 1 }); // filtered to subscribed country
    await app.close();
  });

  it('exports snapshot files and manifest', async () => {
    await ingest(pool, 't', v1, KINDS);
    const out = await mkdtemp(join(tmpdir(), 'ci-'));
    const entry = await exportSnapshot(pool, out);
    const manifest = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'));
    expect(manifest.latest).toBe(entry.snapshot_id);
    expect((await readFile(join(out, 'latest/countries.csv'), 'utf8')).split('\n')[1]).toMatch(/^DE,/);
    expect((await readFile(join(out, 'latest/regions.ndjson'), 'utf8')).trim().split('\n')).toHaveLength(2);
    expect((await readFile(join(out, 'latest/delta.ndjson'), 'utf8')).trim().split('\n')).toHaveLength(4);
  });
});
