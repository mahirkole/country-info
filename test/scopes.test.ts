import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/api.js';
import { migrate } from '../src/db.js';
import { CATALOG } from '../src/scopes/catalog.js';
import { RESOLVERS } from '../src/scopes/resolve.js';
import { resetSchemaCache } from '../src/scopes/schema.js';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('scopes, metadata and profiles', () => {
  const pool = new pg.Pool({ connectionString: url });
  const ADMIN = 'adm';
  let app: Awaited<ReturnType<typeof buildApp>>;
  const country = (cc: string, name: string, data: object) => pool.query(`INSERT INTO entities (id, kind, country_code, code, name, data, content_hash, updated_seq, source_id) VALUES ($1, 'country', $2::text, $2::text, $3, $4, 'h', 0, 'geonames')`, [`country:${cc}`, cc, name, JSON.stringify(data)]);
  const attr = (cc: string, grp: string, data: object) => pool.query(`INSERT INTO entity_attributes (entity_id, grp, data, source, vintage) VALUES ($1, $2, $3, 'cldr', 'CLDR 48')`, [`country:${cc}`, grp, JSON.stringify(data)]);
  const get = (u: string, headers: Record<string, string> = {}) => app.inject({ method: 'GET', url: u, headers });

  beforeAll(async () => {
    await migrate(pool);
    app = await buildApp(pool, { adminToken: ADMIN, exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
  });
  afterAll(async () => { await app.close(); await pool.end(); });
  beforeEach(async () => {
    resetSchemaCache();
    await pool.query('TRUNCATE entity_attributes, locale_formats, scope_profiles, api_keys, entities, sources RESTART IDENTITY CASCADE');
    await pool.query(`INSERT INTO sources (id, authority, url, license, attribution, source_class, license_verdict) VALUES ('cldr','Unicode','u','l','a','community','green'), ('geonames','GeoNames','u','l','a','community','green')`);
    await country('TR', 'Turkey', { iso3: 'TUR', capital: 'Ankara', phone_code: '90' });
    await country('US', 'United States', { iso3: 'USA', capital: 'Washington' });
    await country('DE', 'Germany', { iso3: 'DEU' });
    await attr('TR', 'measurement', { system: 'metric', paper_size: 'A4', temperature: 'metric' });
    await attr('US', 'measurement', { system: 'US', paper_size: 'US-Letter', temperature: 'US' });
    await attr('DE', 'measurement', { system: 'metric', paper_size: 'A4', temperature: 'metric' });
    await attr('TR', 'units', { mass: { person: ['kilogram'] } });
    await attr('US', 'units', { mass: { person: ['pound'] } });
    await attr('TR', 'time', { hour_cycle: 'h23' });
    await attr('US', 'time', { hour_cycle: 'h12' });
    await attr('TR', 'week', { first_day: 'mon', weekend_start: 'sat', weekend_end: 'sun', min_days: 1 });
    await attr('US', 'week', { first_day: 'sun', weekend_start: 'sat', weekend_end: 'sun', min_days: 1 });
    await attr('TR', 'locale', { default: 'tr', language: 'tr', script: 'Latn' });
    await attr('US', 'locale', { default: 'en', language: 'en', script: 'Latn' });
    await pool.query(`INSERT INTO locale_formats (locale, data, source) VALUES ('tr', $1, 'cldr'), ('en', $2, 'cldr')`, [
      JSON.stringify({ date: { short: 'd.MM.y' }, time: { short: 'HH:mm' }, datetime: {}, numbers: { numbering_system: 'latn', decimal: ',', group: '.', percent_pattern: '%#,##0', currency_pattern: '¤#,##0.00' } }),
      JSON.stringify({ date: { short: 'M/d/yy' }, time: { short: 'h:mm a' }, datetime: {}, numbers: { numbering_system: 'latn', decimal: '.', group: ',', percent_pattern: '#,##0%', currency_pattern: '¤#,##0.00' } }),
    ]);
  });

  it('every catalog scope has a resolver and vice versa', () => {
    expect(Object.keys(RESOLVERS).sort()).toEqual(CATALOG.map((s) => s.id).sort());
    expect(CATALOG.filter((s) => s.default).map((s) => s.id)).toEqual(['default']);
  });

  it('lists the catalog and one scope as a schema document', async () => {
    const list = (await get('/v1/scopes')).json();
    expect(list.default_scopes).toEqual(['default']);
    expect(list.data.map((s: { id: string }) => s.id)).toContain('datetime');
    const one = (await get('/v1/scopes/measurement')).json();
    expect(one.properties.paper_size).toMatchObject({ type: 'string', 'x-source': 'cldr', 'x-source-class': 'community', 'x-license-verdict': 'green' });
    expect((await get('/v1/scopes/nope')).statusCode).toBe(404);
  });

  it('composes the default scope and a selection for several countries', async () => {
    const r = (await get('/v1/profile?countries=TR,US&scopes=default,measurement,datetime')).json();
    expect(r.data.TR.default).toMatchObject({ code: 'TR', iso3: 'TUR', capital: 'Ankara' });
    expect(r.data.US.measurement).toMatchObject({ system: 'US', paper_size: 'US-Letter', units: { mass: { person: ['pound'] } } });
    expect(r.data.TR.datetime).toMatchObject({ locale: 'tr', date: { short: 'd.MM.y' }, hour_cycle: 'h23', first_day: 'mon' });
    expect(r.data.US.datetime).toMatchObject({ date: { short: 'M/d/yy' }, hour_cycle: 'h12', first_day: 'sun' });
    const dflt = (await get('/v1/profile?countries=TR')).json();
    expect(Object.keys(dflt.data.TR)).toEqual(['default']);
  });

  it('intersect keeps only fields every country has; union keeps all and reports gaps', async () => {
    const i = (await get('/v1/profile?countries=TR,DE&scopes=measurement,contact&mode=intersect')).json();
    expect(i.data.TR.measurement).toEqual({ system: 'metric', paper_size: 'A4', temperature: 'metric' }); // units missing for DE → dropped
    expect(i.data.TR.contact).toBeNull(); // phone_code only for TR
    expect(i.data.DE.measurement).toEqual(i.data.TR.measurement);
    const u = (await get('/v1/profile?countries=TR,DE&scopes=measurement')).json();
    expect(u.data.TR.measurement.units).toBeDefined();
    expect(u.data.DE.measurement.units).toBeUndefined();
    const sch = (await get('/v1/schema?countries=TR,DE&scopes=measurement&mode=intersect')).json();
    expect(Object.keys(sch.scopes.measurement.properties).sort()).toEqual(['paper_size', 'system', 'temperature']);
    const un = (await get('/v1/schema?countries=TR,DE&scopes=measurement&mode=union')).json();
    expect(un.scopes.measurement.properties.units['x-present-in']).toEqual(['TR']);
  });

  it('country metadata lists only populated fields; unknown countries and bad input are reported', async () => {
    const s = (await get('/v1/schema/countries/DE?scopes=measurement,datetime,currency')).json();
    expect(s.scopes.datetime.properties).toEqual({});
    expect(s.scopes.currency.properties).toEqual({});
    expect(s.scopes.measurement.properties.system).toBeDefined();
    const m = (await get('/v1/profile?countries=TR,ZZ&scopes=locale')).json();
    expect(m.unknown_countries).toEqual(['ZZ']);
    expect((await get('/v1/schema/countries/ZZ')).statusCode).toBe(404);
    expect((await get('/v1/profile?scopes=default')).statusCode).toBe(400);
    expect((await get('/v1/profile?countries=TR&scopes=nope')).statusCode).toBe(400);
    expect((await get('/v1/profile?countries=TR&mode=x')).statusCode).toBe(400);
  });

  it('locale override and a missing locale', async () => {
    const r = (await get('/v1/profile?countries=TR&scopes=numbers&locale=en')).json();
    expect(r.data.TR.numbers).toMatchObject({ locale: 'en', decimal: '.' });
    const x = (await get('/v1/profile?countries=TR&scopes=numbers&locale=xx')).json();
    expect(x.data.TR.numbers).toBeNull();
    expect(x.omitted[0].reason).toMatch(/xx/);
  });

  it('global metadata carries coverage', async () => {
    const g = (await get('/v1/schema')).json();
    expect(g.countries_total).toBe(3);
    expect(g.scopes.measurement.properties.system['x-coverage']).toBe(1);
    expect(g.scopes.measurement.properties.units['x-present-in']).toEqual(['TR', 'US']);
  });

  it('/v1/countries/:code?scopes= returns just the scopes (plain call unchanged)', async () => {
    const r = (await get('/v1/countries/US?scopes=currency,measurement')).json();
    expect(r.scopes.measurement.system).toBe('US');
    expect(r.scopes.currency).toBeNull();
    expect((await get('/v1/countries/US')).json().code).toBe('US');
  });

  it('profiles are owned by their key; a default profile applies when no scopes are given', async () => {
    const mk = async (name: string) => (await app.inject({ method: 'POST', url: '/v1/api-keys', headers: { authorization: `Bearer ${ADMIN}` }, payload: { name } })).json().key as string;
    const k1 = await mk('a');
    const k2 = await mk('b');
    const h1 = { 'x-api-key': k1 };
    const created = await app.inject({ method: 'POST', url: '/v1/scope-profiles', headers: h1, payload: { name: 'metric-ui', scopes: ['measurement', 'datetime'], countries: ['tr', 'us'], mode: 'intersect', default: true } });
    expect(created.statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/v1/scope-profiles', headers: h1, payload: { name: 'metric-ui' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: '/v1/scope-profiles', headers: h1, payload: { name: 'bad', scopes: ['zzz'] } })).statusCode).toBe(400);
    // k2 sees nothing and cannot use it
    expect((await app.inject({ method: 'GET', url: '/v1/scope-profiles', headers: { 'x-api-key': k2 } })).json().data).toEqual([]);
    expect((await get('/v1/profile?profile=metric-ui', { 'x-api-key': k2 })).statusCode).toBe(400);
    // k1: the saved profile fills countries/scopes/mode; the key default needs no ?profile
    const viaName = (await get('/v1/profile?profile=metric-ui', h1)).json();
    expect(viaName.countries).toEqual(['TR', 'US']);
    expect(Object.keys(viaName.data.TR)).toEqual(['measurement', 'datetime']);
    const viaDefault = (await get('/v1/profile', h1)).json();
    expect(viaDefault.mode).toBe('intersect');
    // explicit parameters win
    expect(Object.keys((await get('/v1/profile?scopes=default', h1)).json().data.TR)).toEqual(['default']);
    const id = created.json().id;
    expect((await app.inject({ method: 'DELETE', url: `/v1/scope-profiles/${id}`, headers: { 'x-api-key': k2 } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/v1/scope-profiles/${id}`, headers: h1 })).statusCode).toBe(204);
    expect((await get('/v1/profile?countries=TR', h1)).json().scopes).toEqual(['default']); // default cleared
  });
});

import { exportSnapshot } from '../src/export.js';
import { readFile } from 'node:fs/promises';
describe.skipIf(!url)('attribute export', () => {
  const pool = new pg.Pool({ connectionString: url });
  afterAll(() => pool.end());
  it('writes attributes and locale formats, global and per country; the commercial profile drops attributes of uncleared sources', async () => {
    await migrate(pool);
    await pool.query('TRUNCATE entity_attributes, locale_formats, snapshots, changes, entities, sources RESTART IDENTITY CASCADE');
    await pool.query(`INSERT INTO sources (id, authority, url, license, attribution, source_class, license_verdict) VALUES ('cldr','U','u','l','a','community','green'), ('geonames','G','u','l','a','community','green')`);
    await pool.query(`INSERT INTO entities (id, kind, country_code, code, name, data, content_hash, updated_seq, source_id) VALUES ('country:TR','country','TR','TR','Turkey','{}','h',1,'geonames')`);
    await pool.query(`INSERT INTO entity_attributes (entity_id, grp, data, source, vintage) VALUES ('country:TR','measurement','{"system":"metric"}','cldr','CLDR 48')`);
    await pool.query(`INSERT INTO locale_formats (locale, data, source, vintage) VALUES ('tr','{"date":{"short":"d.MM.y"}}','cldr','CLDR 48')`);
    await pool.query(`INSERT INTO snapshots (id, source, from_seq, to_seq, finished_at, reason) VALUES (1,'geonames',0,1,now(),'test')`);
    const dir = await mkdtemp(join(tmpdir(), 'ex-'));
    const m = await exportSnapshot(pool, dir, 1, {});
    expect(m.files['attributes.ndjson']).toBeDefined();
    expect(m.files['by-country/TR/attributes.json']).toBeDefined();
    expect(JSON.parse((await readFile(join(dir, 'latest', 'attributes.ndjson'), 'utf8')).trim())).toMatchObject({ country: 'TR', measurement: { system: 'metric' }, vintage: 'CLDR 48' });
    expect((await readFile(join(dir, 'latest', 'locale_formats.ndjson'), 'utf8')).trim()).toContain('"locale":"tr"');
    await pool.query("UPDATE sources SET license_verdict = 'red' WHERE id = 'cldr'");
    await exportSnapshot(pool, dir, 1, { commercialOnly: true });
    expect(await readFile(join(dir, 'latest', 'attributes.ndjson'), 'utf8')).toBe('');
    expect(await readFile(join(dir, 'latest', 'locale_formats.ndjson'), 'utf8')).toBe('');
  });
});
