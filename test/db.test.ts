import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../src/db.js';
import { ingest, DeleteGuardError } from '../src/ingest.js';
import { linkRegions } from '../src/linking.js';
import { buildApp } from '../src/api.js';
import { processDeliveries, sign } from '../src/webhooks.js';
import { exportSnapshot } from '../src/export.js';
import type { EntityInput } from '../src/model.js';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

const E = (id: string, kind: EntityInput['kind'], cc: string, name: string, parent: string | null, data = {}): EntityInput =>
  ({ id, kind, parent_id: parent, country_code: cc, code: id.split(':')[1]!, name, name_ascii: null, lat: null, lon: null, data });
const KINDS = ['country', 'admin1', 'admin2'];
const SRC = { id: 't', authority: 'test', attribution: 'Credit line for t' };
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
    await pool.query('TRUNCATE webhook_deliveries, webhook_subscriptions, changes, snapshots, entities, entity_links, review_items, sources RESTART IDENTITY CASCADE');
  });
  afterAll(() => pool.end());

  it('first ingest inserts everything, second is a no-op', async () => {
    const r1 = await ingest(pool, SRC, v1, { kinds: KINDS });
    expect(r1).toMatchObject({ inserted: 4, updated: 0, deleted: 0, unchanged: 0 });
    const r2 = await ingest(pool, SRC, v1, { kinds: KINDS });
    expect(r2).toMatchObject({ inserted: 0, updated: 0, deleted: 0, unchanged: 4, fromSeq: r1.toSeq, toSeq: r1.toSeq });
  });

  it('records update and delete deltas with before/after', async () => {
    const r1 = await ingest(pool, SRC, v1, { kinds: KINDS });
    const v2 = [
      E('country:TR', 'country', 'TR', 'Türkiye', null, { population: 2 }),
      E('country:DE', 'country', 'DE', 'Germany', null),
      E('gn:1', 'admin1', 'TR', 'Istanbul', 'country:TR'),
      // gn:2 removed, gn:3 added
      E('gn:3', 'admin2', 'TR', 'Kadikoy', 'gn:1'),
    ];
    const r2 = await ingest(pool, SRC, v2, { kinds: KINDS });
    expect(r2).toMatchObject({ inserted: 1, updated: 1, deleted: 1, unchanged: 2, fromSeq: r1.toSeq });
    const ch = (await pool.query('SELECT * FROM changes WHERE snapshot_id = $1 ORDER BY seq', [r2.snapshotId])).rows;
    expect(ch.map((c) => `${c.op}:${c.entity_id}`)).toEqual(['insert:gn:3', 'update:country:TR', 'delete:gn:2']);
    expect(ch[1].changed_fields.sort()).toEqual(['data.population', 'name']);
    expect(ch[1].before.name).toBe('Turkey');
    expect(ch[2].before.name).toBe('Fatih');
    expect((await pool.query("SELECT count(*)::int n FROM entities")).rows[0].n).toBe(4);
  });

  it('keeps sources isolated: one source never deletes or claims another source\'s records', async () => {
    await ingest(pool, SRC, v1, { kinds: KINDS });
    const other = { id: 'o', authority: 'other' };
    const nuts = [E('nuts:TR1', 'nuts1', 'TR', 'Istanbul Region', 'country:TR')];
    await ingest(pool, other, nuts, { kinds: ['nuts1'] });
    // Re-ingesting 'o' with no nuts must delete only its own record.
    const r = await ingest(pool, other, [], { kinds: ['nuts1', 'admin1'] });
    expect(r.deleted).toBe(1);
    expect((await pool.query("SELECT count(*)::int n FROM entities WHERE source_id = 't'")).rows[0].n).toBe(4);
    // Country-scoped deletion leaves other countries alone.
    await ingest(pool, other, [E('nuts:DE1', 'nuts1', 'DE', 'BW', 'country:DE'), ...nuts], { kinds: ['nuts1'] });
    const r2 = await ingest(pool, other, [], { kinds: ['nuts1'], countries: ['DE'] });
    expect(r2.deleted).toBe(1);
    expect((await pool.query("SELECT id FROM entities WHERE source_id = 'o'")).rows.map((x) => x.id)).toEqual(['nuts:TR1']);
    // Claiming an id that belongs to another source is refused.
    await expect(ingest(pool, other, [E('gn:1', 'admin1', 'TR', 'Istanbul', 'country:TR')], { kinds: ['admin1'] })).rejects.toThrow(/already exists/);
  });

  it('serves holidays by region chain, and a corrected listed date shows up as delta', async () => {
    const hol = (id: string, date: string, parent: string, type = 'public') => E(`hol:DE:${date}:${id}`, 'holiday', 'DE', id, parent, { date, type, rule_id: id });
    const base = [
      E('country:DE', 'country', 'DE', 'Germany', null),
      E('nuts:DE2', 'nuts1', 'DE', 'Bayern', 'country:DE'),
      E('nuts:DE21', 'nuts2', 'DE', 'Oberbayern', 'nuts:DE2'),
      E('nuts:DE1', 'nuts1', 'DE', 'Baden-Württemberg', 'country:DE'),
    ];
    await ingest(pool, SRC, base, { kinds: ['country', 'nuts1', 'nuts2'] });
    const hs = { id: 'official-holidays', authority: 'test' };
    const v1h = [hol('neujahr', '2026-01-01', 'country:DE'), hol('drei-koenige', '2026-01-06', 'nuts:DE2'), hol('fronleichnam', '2026-06-04', 'nuts:DE1')];
    await ingest(pool, hs, v1h, { kinds: ['holiday'], countries: ['DE'] });
    const app = await buildApp(pool, { adminToken: 'tok', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    const ids = async (u: string) => (await app.inject(u)).json().data.map((r: { data: { rule_id: string } }) => r.data.rule_id);
    expect(await ids('/v1/countries/DE/holidays?year=2026')).toEqual(['neujahr']);
    expect(await ids('/v1/countries/DE/holidays?year=2026&region=nuts:DE21')).toEqual(['neujahr', 'drei-koenige']); // inherits from nuts1 ancestor
    expect(await ids('/v1/holidays?date=2026-06-04')).toEqual(['fronleichnam']);
    expect((await app.inject('/v1/holidays?date=nope')).statusCode).toBe(400);

    // Source corrects a date: delta is an update of that one record with the changed field.
    const before = (await pool.query('SELECT max(seq) s FROM changes')).rows[0].s;
    const corrected = v1h.map((h) => (h.data.rule_id === 'neujahr' ? { ...h, data: { ...h.data, verification: 'verified' } } : h));
    const r = await ingest(pool, hs, corrected, { kinds: ['holiday'], countries: ['DE'] });
    expect(r).toMatchObject({ updated: 1, inserted: 0, deleted: 0 });
    const ch = (await pool.query('SELECT entity_id, op, changed_fields FROM changes WHERE seq > $1', [before])).rows;
    expect(ch).toEqual([{ entity_id: 'hol:DE:2026-01-01:neujahr', op: 'update', changed_fields: ['data.verification'] }]);
    await app.close();
  });

  it('filters webhooks by kind', async () => {
    await pool.query("INSERT INTO webhook_subscriptions (url, secret, kinds) VALUES ('https://x.test/h', 's', ARRAY['holiday'])");
    await ingest(pool, SRC, v1, { kinds: KINDS });
    expect((await pool.query('SELECT count(*)::int n FROM webhook_deliveries')).rows[0].n).toBe(0);
    await ingest(pool, { id: 'h', authority: 'h' }, [E('hol:TR:2026-01-01:y', 'holiday', 'TR', 'Yilbasi', 'country:TR', { date: '2026-01-01' })], { kinds: ['holiday'] });
    const d = (await pool.query('SELECT payload FROM webhook_deliveries')).rows;
    expect(d).toHaveLength(1);
    expect(d[0].payload.changes_url).toContain('kind=holiday');
  });

  it('refuses to delete too much of a source and leaves the data untouched', async () => {
    const many = [E('country:TR', 'country', 'TR', 'Turkey', null), ...Array.from({ length: 200 }, (_, i) => E(`gn:${i + 10}`, 'admin1', 'TR', `R${i}`, 'country:TR'))];
    await ingest(pool, SRC, many, { kinds: KINDS });
    const before = (await pool.query('SELECT max(seq) s FROM changes')).rows[0].s;
    await expect(ingest(pool, SRC, many.slice(0, 20), { kinds: KINDS })).rejects.toThrow(DeleteGuardError);
    expect((await pool.query('SELECT count(*)::int n FROM entities')).rows[0].n).toBe(201);
    expect((await pool.query('SELECT max(seq) s FROM changes')).rows[0].s).toBe(before);
    expect((await pool.query('SELECT count(*)::int n FROM snapshots')).rows[0].n).toBe(1);
    // Small, normal churn (<5%) and an explicit override both pass.
    expect((await ingest(pool, SRC, many.slice(0, 195), { kinds: KINDS })).deleted).toBe(6);
    expect((await ingest(pool, SRC, many.slice(0, 20), { kinds: KINDS, maxDeleteRatio: 1 })).deleted).toBe(175);
  });

  it('links GeoNames admin1 to NUTS, exposes links via the API, and is idempotent', async () => {
    await ingest(pool, { id: 'geonames', authority: 'GeoNames' }, [E('country:DE', 'country', 'DE', 'Germany', null), E('gn:1', 'admin1', 'DE', 'Bavaria', 'country:DE'), E('gn:2', 'admin1', 'DE', 'Hamburg', 'country:DE')], { kinds: KINDS });
    const nuts = { id: 'gisco-nuts', authority: 'x' };
    const n = [E('nuts:DE2', 'nuts1', 'DE', 'Bayern', 'country:DE', { name_latin: 'Bayern' }), E('nuts:DE6', 'nuts1', 'DE', 'Hamburg', 'country:DE', { name_latin: 'Hamburg' })];
    await ingest(pool, nuts, n, { kinds: ['nuts1'] });
    const p1 = await linkRegions(pool);
    expect(p1.links.map((l) => `${l.a}>${l.b}`)).toEqual(['gn:2>nuts:DE6']); // "Bavaria" != "Bayern": unmatched, not guessed
    await linkRegions(pool);
    expect((await pool.query('SELECT count(*)::int n FROM entity_links')).rows[0].n).toBe(1);
    const app = await buildApp(pool, { adminToken: 'tok', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    expect((await app.inject('/v1/regions/nuts:DE6')).json().links).toMatchObject([{ id: 'gn:2', method: 'name_exact' }]);
    expect((await app.inject('/v1/review-items')).statusCode).toBe(401);
    await app.close();
  });

  it('canonical=true hides the lower-priority side of a link (official over GeoNames) without deleting it', async () => {
    await ingest(pool, { id: 'geonames', authority: 'GeoNames' }, [E('country:DE', 'country', 'DE', 'Germany', null), E('gn:2', 'admin1', 'DE', 'Hamburg', 'country:DE')], { kinds: KINDS });
    await ingest(pool, { id: 'gisco-nuts', authority: 'x' }, [E('nuts:DE6', 'nuts1', 'DE', 'Hamburg', 'country:DE', { name_latin: 'Hamburg' })], { kinds: ['nuts1'] });
    await linkRegions(pool);
    expect((await pool.query("SELECT id, priority FROM sources WHERE id IN ('geonames','gisco-nuts') ORDER BY id")).rows).toEqual([{ id: 'geonames', priority: 10 }, { id: 'gisco-nuts', priority: 30 }]);
    const app = await buildApp(pool, { adminToken: 'tok', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    const ids = async (u: string) => (await app.inject(u)).json().data.map((r: { id: string }) => r.id).sort();
    expect(await ids('/v1/search?q=hamburg')).toEqual(['gn:2', 'nuts:DE6']);
    expect(await ids('/v1/search?q=hamburg&canonical=true')).toEqual(['nuts:DE6']);
    await app.close();
  });

  it('filters by source class (official_only) and exposes names and xrefs on a region', async () => {
    await ingest(pool, SRC, [E('country:DE', 'country', 'DE', 'Germany', null), E('gn:1', 'admin1', 'DE', 'Istanbul', 'country:DE')], { kinds: KINDS });
    await ingest(pool, { id: 'gisco-nuts', authority: 'x' }, [E('nuts:DE6', 'nuts1', 'DE', 'Hamburg', 'country:DE')], { kinds: ['nuts1'] });
    await pool.query(`UPDATE sources SET source_class = 'official' WHERE id = 'gisco-nuts'`);
    await pool.query(`UPDATE sources SET source_class = 'community' WHERE id = 't'`);
    await pool.query(`INSERT INTO entity_xrefs(entity_id, scheme, value, source) VALUES ('nuts:DE6','wikidata','Q1055','wikidata')`);
    await pool.query(`INSERT INTO entity_names(entity_id, lang, name, source) VALUES ('nuts:DE6','tr','Hamburg','wikidata')`);
    const app = await buildApp(pool, { adminToken: 'tok', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    const ids = async (u: string) => (await app.inject(u)).json().data.map((r: { id: string }) => r.id);
    expect(await ids('/v1/search?q=hamburg&official_only=true')).toEqual(['nuts:DE6']);
    expect(await ids('/v1/search?q=istanbul')).toEqual(['gn:1']);
    expect(await ids('/v1/search?q=istanbul&official_only=true')).toEqual([]);
    const r = (await app.inject('/v1/regions/nuts:DE6')).json();
    expect(r.names).toEqual({ tr: 'Hamburg' });
    expect(JSON.stringify(r.xrefs)).toContain('Q1055');
    await app.close();
  });

  it('serves national divisions by level and type, isolated per source', async () => {
    await ingest(pool, SRC, [E('country:FR', 'country', 'FR', 'France', null)], { kinds: ['country'] });
    const nat = { id: 'nat-fr', authority: 'INSEE' };
    const div = (id: string, parent: string, level: number, type: string) => ({ ...E(`div:FR:${id}`, 'division', 'FR', id, parent, { level, type }) });
    await ingest(pool, nat, [div('reg-11', 'country:FR', 1, 'region'), div('dep-75', 'div:FR:reg-11', 2, 'department'), div('com-75056', 'div:FR:dep-75', 3, 'municipality')], { kinds: ['division'], countries: ['FR'] });
    const app = await buildApp(pool, { adminToken: 'tok', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    const ids = async (u: string) => (await app.inject(u)).json().data.map((r: { id: string }) => r.id);
    expect(await ids('/v1/countries/FR/divisions?level=2')).toEqual(['div:FR:dep-75']);
    expect(await ids('/v1/countries/FR/divisions?type=municipality&source=nat-fr')).toEqual(['div:FR:com-75056']);
    expect(await ids('/v1/countries/FR/divisions?source=other')).toEqual([]);
    expect(await ids('/v1/regions/div:FR:dep-75/children')).toEqual(['div:FR:com-75056']);
    await app.close();
  });

  it('commercial export profile leaves out sources that are not cleared', async () => {
    await ingest(pool, SRC, [E('country:TR', 'country', 'TR', 'Turkey', null), E('gn:1', 'admin1', 'TR', 'Istanbul', 'country:TR')], { kinds: KINDS });
    const red = { id: 'red-src', authority: 'r' };
    const green = { id: 'green-src', authority: 'g' };
    await ingest(pool, red, [E('lau:TR1', 'lau', 'TR', 'RestrictedPlace', 'country:TR')], { kinds: ['lau'] });
    await ingest(pool, green, [E('nuts:TR1', 'nuts1', 'TR', 'OpenRegion', 'country:TR')], { kinds: ['nuts1'] });
    await pool.query("UPDATE sources SET license_verdict = 'amber' WHERE id = 't'");
    await pool.query("UPDATE sources SET license_verdict = 'red' WHERE id = 'red-src'");
    await pool.query("UPDATE sources SET license_verdict = 'green' WHERE id = 'green-src'");
    const lines = async (out: string, f: string) => (await readFile(join(out, 'latest', f), 'utf8')).trim().split('\n').filter(Boolean);
    const all = await mkdtemp(join(tmpdir(), 'ex-'));
    await exportSnapshot(pool, all);
    expect((await lines(all, 'regions.ndjson')).length).toBe(3);
    const commercial = await mkdtemp(join(tmpdir(), 'ex-'));
    await exportSnapshot(pool, commercial, undefined, { commercialOnly: true });
    const regions = (await lines(commercial, 'regions.ndjson')).map((l) => JSON.parse(l).id).sort();
    expect(regions).toEqual(['gn:1', 'nuts:TR1']); // lau:TR1 (red) is gone
    expect(await readFile(join(commercial, 'latest/ATTRIBUTION.md'), 'utf8')).not.toContain('red-src');
    // snapshot ids: 1 = t, 2 = red-src, 3 = green-src; the delta file follows the same rule
    const d3 = await mkdtemp(join(tmpdir(), 'ex-'));
    await exportSnapshot(pool, d3, 3, { commercialOnly: true });
    expect((await lines(d3, 'delta.ndjson')).map((l) => JSON.parse(l).entity_id)).toEqual(['nuts:TR1']);
    const d2 = await mkdtemp(join(tmpdir(), 'ex-'));
    await exportSnapshot(pool, d2, 2, { commercialOnly: true });
    expect(await lines(d2, 'delta.ndjson')).toEqual([]);
    const d2all = await mkdtemp(join(tmpdir(), 'ex-'));
    await exportSnapshot(pool, d2all, 2);
    expect((await lines(d2all, 'delta.ndjson')).map((l) => JSON.parse(l).entity_id)).toEqual(['lau:TR1']);
  });

  it('is atomic: a bad source leaves nothing behind', async () => {
    await expect(ingest(pool, SRC, [E('gn:9', 'admin1', 'TR', 'Orphan', 'country:NOPE')], { kinds: KINDS })).rejects.toThrow();
    expect((await pool.query('SELECT count(*)::int n FROM snapshots')).rows[0].n).toBe(0);
  });

  it('serves countries, regions and cursor-based changes', async () => {
    await ingest(pool, SRC, v1, { kinds: KINDS });
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
    expect((await get('/v1/sources')).data).toMatchObject([{ id: 't', attribution: 'Credit line for t' }]);
    await app.close();
  });

  it('protects webhook admin and delivers signed notifications with retry', async () => {
    const app = await buildApp(pool, { adminToken: 'tok', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    expect((await app.inject({ method: 'POST', url: '/v1/webhooks', payload: { url: 'https://x.test/h' } })).statusCode).toBe(401);
    const created = await app.inject({ method: 'POST', url: '/v1/webhooks', headers: { authorization: 'Bearer tok' }, payload: { url: 'https://x.test/h', countries: ['de'] } });
    expect(created.statusCode).toBe(201);
    const { secret } = created.json();

    await ingest(pool, SRC, v1, { kinds: KINDS });
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
    await ingest(pool, SRC, v1, { kinds: KINDS });
    const out = await mkdtemp(join(tmpdir(), 'ci-'));
    const entry = await exportSnapshot(pool, out);
    const manifest = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'));
    expect(manifest.latest).toBe(entry.snapshot_id);
    expect((await readFile(join(out, 'latest/countries.csv'), 'utf8')).split('\n')[1]).toMatch(/^DE,/);
    expect((await readFile(join(out, 'latest/regions.ndjson'), 'utf8')).trim().split('\n')).toHaveLength(2);
    expect(await readFile(join(out, 'latest/holidays.csv'), 'utf8')).toMatch(/^date,country/);
    expect(await readFile(join(out, 'latest/ATTRIBUTION.md'), 'utf8')).toMatch(/## t\n- Authority: test[\s\S]*Credit: Credit line for t/);
    expect((await readFile(join(out, 'latest/delta.ndjson'), 'utf8')).trim().split('\n')).toHaveLength(4);
  });
});
