import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/api.js';
import { migrate } from '../src/db.js';
import { parseDriving, parsePhoneMetadata, parseZoneTab } from '../src/sources/attributes.js';
import { resetSchemaCache } from '../src/scopes/schema.js';

const many = (f: (i: number) => string, n = 210) => Array.from({ length: n }, (_, i) => f(i)).join('\n');
const cc = (i: number) => String.fromCharCode(65 + Math.floor(i / 26) % 26) + String.fromCharCode(65 + (i % 26));

describe('attribute source parsers', () => {
  it('zone.tab: countries with several zones, links, comments; layout changes throw', () => {
    const text = '# header\n#country-\n' + many((i) => `${cc(i)}\t+0000+00000\tEurope/Zone${i}`) + '\nUS\t+404251-0740023\tAmerica/New_York\tEastern (most areas)\nUS\t+421953-0830245\tAmerica/Detroit\tEastern - MI';
    const z = parseZoneTab(text);
    expect(z.get('US')).toEqual([{ id: 'America/New_York', comment: 'Eastern (most areas)' }, { id: 'America/Detroit', comment: 'Eastern - MI' }]);
    expect(z.get('AA')![0]!.id).toBe('Europe/Zone0');
    expect(() => parseZoneTab('AD\t+4230+00131\tEurope/Andorra')).toThrow(/layout changed/); // too few countries
    expect(() => parseZoneTab(text + '\nXX garbage')).toThrow(/unexpected row/);
  });
  it('libphonenumber: calling code and prefixes, 001 skipped, shared codes', () => {
    const xml = '<territories>\n<territory id="001" countryCode="800" internationalPrefix="">\n' + many((i) => `<territory id="${cc(i)}" countryCode="${(i % 900) + 1}" internationalPrefix="00">`) +
      '\n<territory id="US" countryCode="1" internationalPrefix="011" mainCountryForCode="true" nationalPrefix="1">\n<territory id="TR" countryCode="90" internationalPrefix="00" nationalPrefix="0">\n</territories>';
    const p = parsePhoneMetadata(xml);
    expect(p.has('001')).toBe(false);
    expect(p.get('US')).toEqual({ calling_code: '1', international_prefix: '011', national_prefix: '1', main_country_for_code: true });
    expect(p.get('TR')).toEqual({ calling_code: '90', international_prefix: '00', national_prefix: '0' });
    expect(() => parsePhoneMetadata('<territory id="TR" countryCode="90">')).toThrow(/layout changed/);
    expect(() => parsePhoneMetadata(xml.replace('countryCode="90"', 'countryCode=""'))).toThrow(/countryCode/);
  });
  it('driving side: conflicting statements drop the country, unknown labels are ignored', () => {
    const rows = Array.from({ length: 210 }, (_, i) => ({ cc: { value: cc(i) }, sideLabel: { value: i % 2 ? 'left' : 'right' } }));
    const d = parseDriving([...rows, { cc: { value: 'AA' }, sideLabel: { value: 'left' } }, { cc: { value: 'ZZ' }, sideLabel: { value: 'weird' } }]);
    expect(d.has('AA')).toBe(false); // right and left → ambiguous
    expect(d.get('AB')).toBe('left');
    expect(d.has('ZZ')).toBe(false);
    expect(() => parseDriving(rows.slice(0, 50))).toThrow(/result changed/);
  });
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('timezones, telephony and traffic scopes', () => {
  const pool = new pg.Pool({ connectionString: url });
  afterAll(() => pool.end());
  beforeEach(async () => {
    resetSchemaCache();
    await migrate(pool);
    await pool.query('TRUNCATE entity_attributes, entities, sources RESTART IDENTITY CASCADE');
    await pool.query(`INSERT INTO sources (id, authority, url, license, attribution, source_class, license_verdict) VALUES ('iana-tz','IANA','u','l','a','community','green'), ('libphonenumber','G','u','l','a','community','green'), ('wikidata-driving','W','u','l','a','community','green')`);
    for (const c of ['TR', 'US']) await pool.query(`INSERT INTO entities (id, kind, country_code, code, name, data, content_hash, updated_seq, source_id) VALUES ($1, 'country', $2::text, $2::text, $2::text, '{}', 'h', 0, 'iana-tz')`, [`country:${c}`, c]);
    const a = (c: string, grp: string, data: object, source: string) => pool.query(`INSERT INTO entity_attributes (entity_id, grp, data, source, vintage) VALUES ($1, $2, $3, $4, 'v')`, [`country:${c}`, grp, JSON.stringify(data), source]);
    await a('TR', 'timezones', { count: 1, ids: ['Europe/Istanbul'], zones: [{ id: 'Europe/Istanbul' }] }, 'iana-tz');
    await a('US', 'timezones', { count: 2, ids: ['America/New_York', 'America/Detroit'], zones: [] }, 'iana-tz');
    await a('TR', 'telephony', { calling_code: '90', national_prefix: '0', international_prefix: '00' }, 'libphonenumber');
    await a('US', 'telephony', { calling_code: '1', national_prefix: '1', international_prefix: '011', main_country_for_code: true }, 'libphonenumber');
    await a('TR', 'driving', { side: 'right' }, 'wikidata-driving');
  });
  it('serves the three scopes and intersects them', async () => {
    const app = await buildApp(pool, { adminToken: 't', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    const r = (await app.inject({ url: '/v1/profile?countries=TR,US&scopes=timezones,telephony,traffic' })).json();
    expect(r.data.TR.timezones.ids).toEqual(['Europe/Istanbul']);
    expect(r.data.US.telephony).toMatchObject({ calling_code: '1', main_country_for_code: true });
    expect(r.data.TR.traffic).toEqual({ driving_side: 'right' });
    expect(r.data.US.traffic).toBeNull();
    const i = (await app.inject({ url: '/v1/profile?countries=TR,US&scopes=telephony,traffic&mode=intersect' })).json();
    expect(i.data.TR.telephony).toEqual({ calling_code: '90', national_prefix: '0', international_prefix: '00' }); // main_country_for_code only in US
    expect(i.data.TR.traffic).toBeNull();
    const sch = (await app.inject({ url: '/v1/schema/countries/TR?scopes=telephony,traffic' })).json();
    expect(sch.scopes.telephony.properties.calling_code['x-source']).toBe('libphonenumber');
    expect(sch.scopes.traffic.properties.driving_side['x-license-verdict']).toBe('green');
    await app.close();
  });
});
