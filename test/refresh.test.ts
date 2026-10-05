import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import http from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../src/db.js';
import { buildApp } from '../src/api.js';
import { orphanParents, runRefresh, dueSourceIds } from '../src/refresh.js';
import { ackLicense, checkLicenses, licenseExcerpt } from '../src/license-watch.js';
import { logBody } from '../src/sources/fetch.js';
import { sourceClassOf, syncTargetMetadata, type RefreshTarget } from '../src/targets.js';
import type { EntityInput } from '../src/model.js';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

const E = (id: string, name: string, parent: string | null = 'country:TR'): EntityInput => ({
  id, kind: 'division', parent_id: parent, country_code: 'TR', code: id, name, name_ascii: null, lat: null, lon: null, data: { level: 1, type: 'region' },
});
const many = (n: number, suffix = '') => Array.from({ length: n }, (_, i) => E(`div:TR:${i}`, `R${i}${suffix}`));

/** A fake source: `state.body` stands for the downloaded bytes, `state.rows` for what they parse into. */
function target(state: { body: string; rows: EntityInput[]; version?: string; band?: [number, number]; licenseUrls?: string[] }): RefreshTarget {
  return {
    meta: { id: 'nat-fake', authority: 'Fake', get version() { return state.version; }, attribution: 'x' } as RefreshTarget['meta'],
    cadence: 'monthly',
    get expectedRows() { return state.band ?? [100, 400]; },
    scope: { kinds: ['division'], countries: ['TR'] },
    async load() { logBody(state.body); return state.rows; },
    licenseUrls: state.licenseUrls ?? [],
    licenseVerdict: 'green',
    commercialUse: 'test',
  } as RefreshTarget;
}

d('refresh', () => {
  let pool: pg.Pool;
  let cache: string;
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrate(pool);
    cache = await mkdtemp(join(tmpdir(), 'rf-'));
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE webhook_deliveries, webhook_subscriptions, changes, snapshots, entities, entity_links, review_items, source_runs, sources RESTART IDENTITY CASCADE');
    await pool.query("INSERT INTO sources (id, authority) VALUES ('geonames','g') ON CONFLICT DO NOTHING");
    await pool.query("INSERT INTO entities (id, kind, country_code, name, content_hash, updated_seq, source_id) VALUES ('country:TR','country','TR','Turkey','h',0,'geonames')");
  });
  afterAll(() => pool.end());

  const head = async () => Number((await pool.query('SELECT COALESCE(max(seq),0) s FROM changes')).rows[0].s);
  const status = async () => (await pool.query("SELECT status FROM sources WHERE id='nat-fake'")).rows[0].status as string;

  it('first run applies; identical raw inputs are skipped with zero writes; changed inputs apply a delta', async () => {
    const st = { body: 'v1', rows: many(150) };
    expect(await runRefresh(pool, target(st), { cacheDir: cache })).toMatchObject({ status: 'success', inserted: 150 });
    const seq = await head();
    expect(await runRefresh(pool, target(st), { cacheDir: cache })).toMatchObject({ status: 'unchanged' });
    expect(await head()).toBe(seq);
    st.body = 'v2';
    st.rows = [...many(150).slice(0, 149), E('div:TR:149', 'Renamed')];
    expect(await runRefresh(pool, target(st), { cacheDir: cache })).toMatchObject({ status: 'success', updated: 1, inserted: 0, deleted: 0 });
    const runs = (await pool.query('SELECT status FROM source_runs ORDER BY id')).rows.map((r) => r.status);
    expect(runs).toEqual(['success', 'unchanged', 'success']);
    expect(await status()).toBe('ok');
    expect((await pool.query("SELECT next_due_at > now() AS future, cadence FROM sources WHERE id='nat-fake'")).rows[0]).toEqual({ future: true, cadence: 'monthly' });
  });

  it('refuses a result outside the expected row band and writes nothing', async () => {
    const r = await runRefresh(pool, target({ body: 'x', rows: many(3) }), { cacheDir: cache });
    expect(r).toMatchObject({ status: 'needs_review' });
    expect(r.detail).toMatch(/outside the expected band/);
    expect((await pool.query("SELECT count(*)::int n FROM entities WHERE kind='division'")).rows[0].n).toBe(0);
    expect(await status()).toBe('needs_review');
  });

  it('refuses a broken hierarchy (parents missing from the batch)', async () => {
    expect(orphanParents([E('a', 'A', 'div:TR:nope'), E('b', 'B')])).toEqual(['div:TR:nope']);
    const rows = [...many(149), E('div:TR:x', 'X', 'div:TR:missing')];
    expect(await runRefresh(pool, target({ body: 'o', rows }), { cacheDir: cache })).toMatchObject({ status: 'needs_review' });
  });

  it('a truncated download is held for review instead of deleting the dataset', async () => {
    const st = { body: 'full', rows: many(200), band: [10, 400] as [number, number] };
    await runRefresh(pool, target(st), { cacheDir: cache });
    st.body = 'truncated';
    st.rows = many(20);
    const r = await runRefresh(pool, target(st), { cacheDir: cache });
    expect(r).toMatchObject({ status: 'needs_review' });
    expect(r.detail).toMatch(/refusing to delete/);
    expect((await pool.query("SELECT count(*)::int n FROM entities WHERE kind='division'")).rows[0].n).toBe(200);
  });

  it('mass updates need a vintage change; with one they apply and are labelled on the snapshot', async () => {
    const st: { body: string; rows: EntityInput[]; version?: string } = { body: 'a', rows: many(150), version: 'Set 2024' };
    await runRefresh(pool, target(st), { cacheDir: cache });
    st.body = 'b';
    st.rows = many(150, '-new'); // every name changes
    expect(await runRefresh(pool, target(st), { cacheDir: cache })).toMatchObject({ status: 'needs_review' });
    st.version = 'Set 2025';
    const r = await runRefresh(pool, target(st), { cacheDir: cache });
    expect(r).toMatchObject({ status: 'success', updated: 150 });
    expect((await pool.query('SELECT reason FROM snapshots ORDER BY id DESC LIMIT 1')).rows[0].reason).toBe('vintage_change: Set 2024 -> Set 2025');
  });

  it('dry run validates but writes nothing', async () => {
    const r = await runRefresh(pool, target({ body: 'd', rows: many(150) }), { cacheDir: cache, dryRun: true });
    expect(r).toMatchObject({ status: 'success', rows: 150 });
    expect((await pool.query("SELECT count(*)::int n FROM entities WHERE kind='division'")).rows[0].n).toBe(0);
    expect((await pool.query('SELECT count(*)::int n FROM source_runs')).rows[0].n).toBe(0);
  });

  it('a failing download is recorded and retried soon; due selection includes never-run and failed sources', async () => {
    const t = target({ body: '', rows: [] });
    t.load = async () => { throw new Error('GET https://x.test: 500'); };
    expect(await runRefresh(pool, t, { cacheDir: cache })).toMatchObject({ status: 'failed', detail: expect.stringContaining('500') });
    expect(await status()).toBe('failed');
    expect(await dueSourceIds(pool, [t])).toEqual(['nat-fake']);
  });

  it('exposes freshness through /v1/sources and /v1/status', async () => {
    await runRefresh(pool, target({ body: 's', rows: many(3) }), { cacheDir: cache }); // needs_review
    const app = await buildApp(pool, { adminToken: 't', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    const st = (await app.inject('/v1/status')).json();
    expect(st).toMatchObject({ ok: false, attention: [{ id: 'nat-fake', status: 'needs_review' }] });
    expect((await app.inject('/v1/sources')).json().data.find((s: { id: string }) => s.id === 'nat-fake')).toMatchObject({ cadence: 'monthly', license_verdict: 'green', status: 'needs_review' });
    await app.close();
  });
});

describe('license watch', () => {
  it('extracts only licensing sentences and ignores unrelated page changes', () => {
    const a = '<nav>Menu 2026-10-04</nav><p>All material is licensed under Creative Commons Attribution 4.0 International licence.</p><p>Visitors today: 5</p>';
    const b = '<nav>Menu 2026-10-05</nav><p>All material is licensed under Creative Commons Attribution 4.0 International licence.</p><p>Visitors today: 9</p>';
    expect(licenseExcerpt(a)).toBe(licenseExcerpt(b));
    expect(licenseExcerpt(a)).toContain('Creative Commons');
    expect(licenseExcerpt(b.replace('4.0', '3.0'))).not.toBe(licenseExcerpt(a));
  });
});

d('license watch (db)', () => {
  let pool: pg.Pool;
  let server: http.Server;
  let text = 'Data may be reused for commercial and non-commercial purposes under the Open Government Licence provided the source is acknowledged.';
  let port = 0;
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await migrate(pool);
    server = http.createServer((_q, res) => res.end(`<html><body><p>${text}</p></body></html>`));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as { port: number }).port;
  });
  afterAll(async () => {
    server.close();
    await pool.end();
  });

  it('baselines, detects a changed license page, blocks refresh until acknowledged', async () => {
    await pool.query("TRUNCATE entities, changes, snapshots, source_runs, sources RESTART IDENTITY CASCADE");
    const cache = await mkdtemp(join(tmpdir(), 'lw-'));
    const t = target({ body: 'b', rows: many(150), licenseUrls: [`http://127.0.0.1:${port}/lic`] });
    await pool.query("INSERT INTO sources (id, authority) VALUES ('geonames','g')");
    await pool.query("INSERT INTO entities (id, kind, country_code, name, content_hash, updated_seq, source_id) VALUES ('country:TR','country','TR','Turkey','h',0,'geonames')");
    await runRefresh(pool, t, { cacheDir: cache });
    expect((await checkLicenses(pool, [t], cache))[0]!.status).toBe('baseline');
    expect((await checkLicenses(pool, [t], cache))[0]!.status).toBe('unchanged');
    text = 'Data may be reused only for non-commercial purposes. Commercial use requires permission of the data owner.';
    expect((await checkLicenses(pool, [t], cache))[0]).toMatchObject({ status: 'changed' });
    expect((await pool.query("SELECT status FROM sources WHERE id='nat-fake'")).rows[0].status).toBe('license_changed');
    expect(await runRefresh(pool, t, { cacheDir: cache, force: true })).toMatchObject({ status: 'skipped', detail: expect.stringContaining('license') });
    await ackLicense(pool, t, cache);
    expect((await checkLicenses(pool, [t], cache))[0]!.status).toBe('unchanged');
    expect(await runRefresh(pool, t, { cacheDir: cache, force: true })).toMatchObject({ status: 'success' });
  });

  it('classifies sources: national/GISCO/holidays are official, everything else community', async () => {
    expect(['nat-jp', 'gisco-nuts', 'official-holidays'].map(sourceClassOf)).toEqual(['official', 'official', 'official']);
    expect(['geonames', 'wikidata', 'wd-dk'].map(sourceClassOf)).toEqual(['community', 'community', 'community']);
    await syncTargetMetadata(pool, [target({ body: 'x', rows: [] })]);
    expect((await pool.query("SELECT source_class FROM sources WHERE id = 'nat-fake'")).rows[0].source_class).toBe('official');
  });
});
