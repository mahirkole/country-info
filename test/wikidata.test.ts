import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../src/db.js';
import { enrichIso3166_2, enrichWikidata, linkByQid, syncLayerQids } from '../src/enrich.js';
import { lookupQuery, parseLookup, sparql, type Binding } from '../src/sources/wikidata.js';

const b = (v: string, qid: string, lang?: string, label?: string): Binding => ({
  v: { value: v },
  item: { value: `http://www.wikidata.org/entity/${qid}` },
  ...(lang ? { lang: { value: lang }, label: { value: label ?? '' } } : {}),
});

describe('wikidata client', () => {
  it('builds a lookup query with escaped values and the requested languages', () => {
    const q = lookupQuery('P1566', ['745044', 'a"b'], ['en', 'tr']);
    expect(q).toContain('VALUES ?v { "745044" "a\\"b" }');
    expect(q).toContain('?item wdt:P1566 ?v');
    expect(q).toContain('?lang IN ("en", "tr")');
  });
  it('parses QIDs and labels; keeps ambiguity visible', () => {
    const l = parseLookup([b('1', 'Q406', 'en', 'Istanbul'), b('1', 'Q406', 'tr', 'İstanbul'), b('2', 'Q10'), b('2', 'Q11'), b('3', 'not-a-qid')]);
    expect([...l.qids.get('1')!]).toEqual(['Q406']);
    expect(l.qids.get('2')!.size).toBe(2);
    expect(l.qids.has('3')).toBe(false);
    expect(l.labels.get('Q406')!.get('tr')).toBe('İstanbul');
  });
  it('sends a User-Agent, honours Retry-After on 429 and then succeeds', async () => {
    const calls: { ua: string | null }[] = [];
    const sleeps: number[] = [];
    const fetchFn = (async (_u: string, init: RequestInit) => {
      calls.push({ ua: new Headers(init.headers).get('user-agent') });
      return calls.length === 1
        ? new Response('slow down', { status: 429, headers: { 'retry-after': '7' } })
        : new Response(JSON.stringify({ results: { bindings: [b('1', 'Q1')] } }), { status: 200 });
    }) as unknown as typeof fetch;
    const rows = await sparql('SELECT 1', { fetchFn, sleep: async (ms) => void sleeps.push(ms), minIntervalMs: 0 });
    expect(rows).toHaveLength(1);
    expect(calls.length).toBe(2);
    expect(calls[0]!.ua).toMatch(/country-info/);
    expect(sleeps).toContain(7000);
  });
  it('gives up after the retry budget', async () => {
    const fetchFn = (async () => new Response('x', { status: 503 })) as unknown as typeof fetch;
    await expect(sparql('SELECT 1', { fetchFn, sleep: async () => {}, minIntervalMs: 0, retries: 2 })).rejects.toThrow(/WDQS 503/);
  });
});

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d('enrichment (db)', () => {
  let pool: pg.Pool;
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrate(pool);
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE entity_names, entity_xrefs, entity_links, source_runs, changes, snapshots, entities, sources RESTART IDENTITY CASCADE');
    await pool.query("INSERT INTO sources (id, authority, license_verdict) VALUES ('geonames','g','amber'), ('gisco-nuts','e','amber')");
    const ent = (id: string, kind: string, src: string, code: string | null, data: object) =>
      pool.query("INSERT INTO entities (id, kind, country_code, code, name, data, content_hash, updated_seq, source_id) VALUES ($1,$2,'TR',$3,$1,$4,'h',0,$5)", [id, kind, code, JSON.stringify(data), src]);
    await ent('gn:745044', 'admin1', 'geonames', 'TR.34', { geonames_id: 745044 });
    await ent('gn:2', 'admin1', 'geonames', 'TR.02', { geonames_id: 2 });
    await ent('gn:3', 'admin1', 'geonames', 'TR.03', { geonames_id: 3 });
    await ent('nuts:TR10', 'nuts2', 'gisco-nuts', 'TR10', {});
  });
  afterAll(() => pool.end());

  const fake = (rows: Binding[]) => {
    const seen: string[] = [];
    return { seen, run: async (q: string) => (seen.push(q), rows.filter((r) => q.includes(`"${r['v']!.value}"`))) };
  };

  it('stores unique matches with labels, marks ambiguous/missing as checked, and does not ask twice', async () => {
    const f = fake([b('745044', 'Q406', 'en', 'Istanbul'), b('745044', 'Q406', 'tr', 'İstanbul'), b('2', 'Q10'), b('2', 'Q11')]);
    const res = await enrichWikidata(pool, { specs: ['geonames'], run: f.run, langs: ['en', 'tr'] });
    expect(res[0]).toMatchObject({ asked: 3, matched: 1, ambiguous: 1, missing: 1, names: 2 });
    const x = (await pool.query("SELECT entity_id, value FROM entity_xrefs ORDER BY entity_id")).rows;
    expect(x).toEqual([{ entity_id: 'gn:2', value: null }, { entity_id: 'gn:3', value: null }, { entity_id: 'gn:745044', value: 'Q406' }]);
    expect((await pool.query("SELECT lang, name FROM entity_names WHERE entity_id='gn:745044' ORDER BY lang")).rows).toEqual([{ lang: 'en', name: 'Istanbul' }, { lang: 'tr', name: 'İstanbul' }]);
    const again = await enrichWikidata(pool, { specs: ['geonames'], run: f.run });
    expect(again[0]).toMatchObject({ asked: 0 });
    expect(f.seen).toHaveLength(1);
    expect((await pool.query("SELECT status, rows FROM source_runs WHERE source_id='wikidata' ORDER BY id")).rows).toEqual([{ status: 'success', rows: 1 }, { status: 'success', rows: 0 }]);
    expect((await pool.query("SELECT license_verdict, source_class FROM sources WHERE id='wikidata'")).rows[0]).toEqual({ license_verdict: 'green', source_class: 'community' });
  });

  it('links entities of different sources that share a QID, never within one source', async () => {
    const f = fake([b('745044', 'Q406'), b('TR10', 'Q406'), b('2', 'Q99'), b('3', 'Q99')]);
    await enrichWikidata(pool, { specs: ['geonames', 'nuts'], run: f.run });
    expect(await linkByQid(pool)).toBe(1);
    expect((await pool.query("SELECT a_id, b_id, method FROM entity_links")).rows).toEqual([{ a_id: 'gn:745044', b_id: 'nuts:TR10', method: 'wikidata_qid' }]);
    expect(await linkByQid(pool)).toBe(1); // idempotent rebuild
  });

  it('registers layer QIDs as cross references, links them to GeoNames, and stores ISO 3166-2 codes (checked once)', async () => {
    await pool.query("INSERT INTO sources (id, authority, license_verdict) VALUES ('wd-tr','w','green')");
    await pool.query("INSERT INTO entities (id, kind, country_code, code, name, data, content_hash, updated_seq, source_id) VALUES ('div:TR:wd-Q406','division','TR','wd-Q406','Istanbul','{\"wikidata\":\"Q406\"}','h',0,'wd-tr')");
    await pool.query("INSERT INTO entity_xrefs (entity_id, scheme, value, source) VALUES ('gn:745044','wikidata','Q406','wikidata')");
    expect(await syncLayerQids(pool)).toBe(1);
    expect(await linkByQid(pool)).toBe(1); // gn:745044 <-> div:TR:wd-Q406
    const rows = [{ item: { value: 'http://www.wikidata.org/entity/Q406' }, code: { value: 'TR-34' } }] as unknown as Binding[];
    let calls = 0;
    const run = async () => (calls++, rows);
    expect(await enrichIso3166_2(pool, { run })).toEqual({ asked: 2, coded: 2 }); // both entities carry Q406
    expect((await pool.query("SELECT entity_id, value FROM entity_xrefs WHERE scheme='iso3166-2' ORDER BY entity_id")).rows).toEqual([{ entity_id: 'div:TR:wd-Q406', value: 'TR-34' }, { entity_id: 'gn:745044', value: 'TR-34' }]);
    expect(await enrichIso3166_2(pool, { run })).toEqual({ asked: 0, coded: 0 });
    expect(calls).toBe(1);
  });
});

import { buildDivisions, levelQuery, reduceLevel, type WdCountry } from '../src/sources/wikidata-divisions.js';
describe('wikidata divisions', () => {
  const row = (i: string, lang?: string, label?: string, p?: string): Binding => ({
    i: { value: `http://www.wikidata.org/entity/${i}` },
    ...(lang ? { lang: { value: lang }, label: { value: label ?? '' } } : {}),
    ...(p ? { p: { value: `http://www.wikidata.org/entity/${p}` } } : {}),
  });
  const C: WdCountry = {
    cc: 'XX', country: 'Q1', langs: ['da'],
    levels: [
      { key: 'r', classes: ['Q10'], level: 1, type: 'region', typeLocal: 'r', expected: [1, 1], exclude: { Q99: 'merged area' } },
      { key: 'm', classes: ['Q20'], level: 2, type: 'municipality', typeLocal: 'm', expected: [2, 3] },
    ],
  };
  it('queries current instances of the classes, restricted to the country, with ancestors from the levels above', () => {
    const q = levelQuery(C, C.levels[1]!, [C.levels[0]!]);
    expect(q).toContain('VALUES ?cls { wd:Q20 }');
    expect(q).toContain('wdt:P17 wd:Q1');
    expect(q).toContain('FILTER NOT EXISTS { ?i wdt:P576 ?end }');
    expect(q).toContain('VALUES ?pc { wd:Q10 }');
    expect(levelQuery(C, C.levels[0]!, [])).not.toContain('?pc');
  });
  it('prefers the native label, then English, then the QID', () => {
    const r = reduceLevel([row('Q1', 'en', 'Copenhagen'), row('Q1', 'da', 'København'), row('Q2', 'en', 'Only English'), row('Q3')], ['da']);
    expect([...r.names]).toEqual([['Q1', 'København'], ['Q2', 'Only English'], ['Q3', 'Q3']]);
  });
  it('builds the hierarchy, honours exclusions, skips parentless items and enforces the official bands', () => {
    const l1 = reduceLevel([row('Q5', 'da', 'Nord'), row('Q99', 'da', 'Øst')], ['da']);
    const l2 = reduceLevel([row('Q7', 'da', 'A', 'Q5'), row('Q8', 'da', 'B', 'Q5'), row('Q9', 'da', 'C')], ['da']);
    const skipped: string[] = [];
    const e = buildDivisions(C, [l1, l2], skipped);
    expect(e.map((x) => `${x.id}<${x.parent_id}`)).toEqual(['div:XX:wd-Q5<country:XX', 'div:XX:wd-Q7<div:XX:wd-Q5', 'div:XX:wd-Q8<div:XX:wd-Q5']);
    expect(skipped).toEqual(['m Q9 C']);
    const few = reduceLevel([row('Q5', 'da', 'Nord'), row('Q6', 'da', 'Syd')], ['da']);
    expect(() => buildDivisions(C, [few, l2])).toThrow(/official band/);
  });
});

import { parseCurrencies, parseTerritories, parseUnMembers } from '../src/sources/cldr.js';
describe('cldr', () => {
  it('keeps alpha-2 territory names only', () => {
    const j = { main: { tr: { localeDisplayNames: { territories: { '001': 'Dünya', '419': 'LatAm', TR: 'Türkiye', XA: 'Sahte', 'GB-alt-short': 'x', DE: 'Almanya' } } } } };
    expect([...parseTerritories(j, 'tr')]).toEqual([['TR', 'Türkiye'], ['DE', 'Almanya']]);
    expect(() => parseTerritories({ main: {} }, 'tr')).toThrow(/layout changed/);
  });
  it('picks current legal-tender currencies and rejects a truncated file', () => {
    const region: Record<string, unknown[]> = { TR: [{ TRY: { _from: '2005-01-01' } }, { TRL: { _from: '1922-11-01', _to: '2005-12-31' } }], ZW: [{ ZWL: { _from: '2009-01-01', _tender: 'false' } }] };
    for (let i = 0; i < 160; i++) region[`A${i}`] = [{ XXX: { _from: '2000-01-01' } }];
    const m = parseCurrencies({ supplemental: { currencyData: { region } } });
    expect(m.get('TR')).toEqual(['TRY']);
    expect(m.has('ZW')).toBe(false);
    expect(() => parseCurrencies({ supplemental: { currencyData: { region: { TR: [] } } } })).toThrow(/layout changed/);
  });
});

describe('CLDR UN membership (read from the data, not typed in)', () => {
  const codes = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + (i % 26)) + String.fromCharCode(65 + Math.floor(i / 26)));
  const json = (list: string[] | undefined) => ({ supplemental: { territoryContainment: list ? { UN: { _contains: list, _grouping: 'true' } } : {} } });
  it('reads the UN grouping and rejects a missing or implausible one', () => {
    const m = parseUnMembers(json([...codes(190), '001']));
    expect(m.size).toBe(190); // non-alpha-2 entries are ignored
    expect(() => parseUnMembers(json(undefined))).toThrow(/layout changed/);
    expect(() => parseUnMembers(json(codes(40)))).toThrow(/layout changed/);
  });
});
