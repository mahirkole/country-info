import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../src/db.js';
import { enrichWikidata, linkByQid } from '../src/enrich.js';
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
});
