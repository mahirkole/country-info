import type pg from 'pg';
import { fetchText } from './fetch.js';
import { sparql, type Binding } from './wikidata.js';
import { createAttributeReleaseNote } from '../release-notes.js';
import { attributeChanges, recordAttributeChanges } from '../attribute-changes.js';

/** Country attributes from sources other than CLDR: time zones (IANA tz database), telephony (libphonenumber), driving side (Wikidata). */
export const TZ_BASE = 'https://data.iana.org/time-zones/tzdb';
export const PHONE_URL = 'https://raw.githubusercontent.com/google/libphonenumber/master/resources/PhoneNumberMetadata.xml';

export const ATTR_SOURCES = {
  'iana-tz': {
    authority: 'IANA Time Zone Database (tzdb) – country time zones (zone.tab)', url: 'https://www.iana.org/time-zones',
    license: 'Public domain: "Unless specified below, all files in the tz code and data (including this LICENSE file) are in the public domain" (data.iana.org/time-zones/tzdb/LICENSE, read); zone.tab header: "This file is in the public domain".',
    attribution: 'Time zone data: IANA Time Zone Database (public domain).', verdict: 'green', commercial: 'Public domain; no conditions (docs/licenses/iana-tz.md)',
  },
  libphonenumber: {
    authority: 'Google libphonenumber – PhoneNumberMetadata.xml (calling codes and dialling prefixes)', url: 'https://github.com/google/libphonenumber',
    license: 'Apache License 2.0 (file header and repository LICENSE, read): use, reproduce, modify and distribute commercially; keep the license and notices with redistributed copies of the file.',
    attribution: 'Telephone metadata (calling codes and dialling prefixes only) extracted and modified from Google libphonenumber PhoneNumberMetadata.xml, © The Libphonenumber Authors, licensed under the Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0).', verdict: 'green', commercial: 'Apache-2.0 (header, LICENSE incl. section 4 read; no NOTICE file in the repository): commercial use allowed; pass on the license reference and mark modification (docs/licenses/libphonenumber.md)',
  },
  libaddressinput: {
    authority: 'Google libaddressinput – Address Data Service (postal code formats, address layout)', url: 'https://chromium-i18n.appspot.com/ssl-address',
    license: 'CC BY 4.0: the service page states "Copyright 2021 Google LLC. This data is licensed by Google under the CC-BY 4.0 license." and the repository README "Data licensed under the CC-BY 4.0" (both read 2026-10-06).',
    attribution: 'Postal-code and address-format metadata extracted and reformatted from the Google libaddressinput Address Data Service, © Google LLC, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).', verdict: 'green', commercial: 'CC BY 4.0: commercial use and redistribution allowed with attribution and an indication of changes (docs/licenses/libaddressinput.md)',
  },
  'wikidata-driving': {
    authority: 'Wikidata – driving side of countries (P1622)', url: 'https://www.wikidata.org/wiki/Property:P1622',
    license: 'Creative Commons CC0 1.0 (Wikidata:Licensing, read): structured data in the public domain.',
    attribution: 'Driving side from Wikidata (CC0).', verdict: 'green', commercial: 'CC0 1.0: no restrictions; community data (docs/licenses/wikidata.md)',
  },
} as const;
export type AttrSourceId = keyof typeof ATTR_SOURCES;

export interface Zone { id: string; comment?: string }
/** zone.tab: `country<TAB>coordinates<TAB>TZ[<TAB>comments]`; exactly one country per row, a row may be a Link from `backward` (e.g. Europe/Oslo). */
export function parseZoneTab(text: string): Map<string, Zone[]> {
  const out = new Map<string, Zone[]>();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [cc, , id, comment] = line.split('\t');
    if (!cc || !/^[A-Z]{2}$/.test(cc) || !id || !/^[A-Za-z_]+(\/[A-Za-z0-9_+\-]+)+$/.test(id)) throw new Error(`tzdb zone.tab: unexpected row "${line.slice(0, 60)}" — layout changed`);
    const list = out.get(cc) ?? [];
    list.push({ id, ...(comment ? { comment } : {}) });
    out.set(cc, list);
  }
  if (out.size < 200) throw new Error(`tzdb zone.tab: only ${out.size} countries — layout changed`);
  return out;
}

export interface Phone { calling_code: string; international_prefix?: string; national_prefix?: string; main_country_for_code?: boolean }
/** Region `<territory id="TR" countryCode="90" internationalPrefix="00" nationalPrefix="0" mainCountryForCode="true">` start tags of PhoneNumberMetadata.xml. */
export function parsePhoneMetadata(xml: string): Map<string, Phone> {
  const out = new Map<string, Phone>();
  for (const m of xml.matchAll(/<territory\s+([^>]*?)>/g)) {
    const a = Object.fromEntries([...m[1]!.matchAll(/([A-Za-z]+)="([^"]*)"/g)].map((x) => [x[1]!, x[2]!]));
    if (!a.id || !/^[A-Z]{2}$/.test(a.id)) continue; // 001 = non-geographic networks
    if (!a.countryCode || !/^\d{1,3}$/.test(a.countryCode)) throw new Error(`libphonenumber: territory ${a.id} without a valid countryCode — layout changed`);
    out.set(a.id, { calling_code: a.countryCode, ...(a.internationalPrefix ? { international_prefix: a.internationalPrefix } : {}), ...(a.nationalPrefix ? { national_prefix: a.nationalPrefix } : {}), ...(a.mainCountryForCode === 'true' ? { main_country_for_code: true } : {}) });
  }
  if (out.size < 200) throw new Error(`libphonenumber: only ${out.size} territories — layout changed`);
  return out;
}

export const ADDR_BASE = 'https://chromium-i18n.appspot.com/ssl-address/data';

export interface Postal {
  postal_code?: { regex?: string; examples?: string[]; name_type?: string; prefix?: string };
  address_format: { format?: string; required?: string; uppercase?: string; state_name_type?: string; locality_name_type?: string };
  postal_service_url?: string;
}
/** One country record of the Address Data Service (`/data/<CC>`): postal code pattern and examples, address line layout. */
export function parseAddressRecord(j: Record<string, unknown>, cc: string): Postal {
  if (j.key !== cc || typeof j.id !== 'string') throw new Error(`libaddressinput data/${cc}: unexpected record — layout changed`);
  const str = (k: string): string | undefined => (typeof j[k] === 'string' && j[k] !== '' ? (j[k] as string) : undefined);
  const examples = str('zipex')?.split(',').map((x) => x.trim()).filter(Boolean);
  return {
    ...(str('zip') || examples || str('zip_name_type') || str('postprefix') ? { postal_code: { ...(str('zip') ? { regex: str('zip') } : {}), ...(examples ? { examples } : {}), ...(str('zip_name_type') ? { name_type: str('zip_name_type') } : {}), ...(str('postprefix') ? { prefix: str('postprefix') } : {}) } } : {}),
    address_format: { ...(str('fmt') ? { format: str('fmt') } : {}), ...(str('require') ? { required: str('require') } : {}), ...(str('upper') ? { uppercase: str('upper') } : {}), ...(str('state_name_type') ? { state_name_type: str('state_name_type') } : {}), ...(str('locality_name_type') ? { locality_name_type: str('locality_name_type') } : {}) },
    ...(str('posturl') ? { postal_service_url: str('posturl') } : {}),
  };
}

/** The country list (`/data` → `countries: "AC~AD~..."`). */
export function parseAddressCountries(j: Record<string, unknown>): string[] {
  const list = typeof j.countries === 'string' ? j.countries.split('~').filter((c) => /^[A-Z]{2}$/.test(c)) : [];
  if (list.length < 200) throw new Error(`libaddressinput data: only ${list.length} countries — layout changed`);
  return list;
}

async function fetchAddressData(cacheDir: string, only?: string[]): Promise<Map<string, Postal>> {
  const countries = only ?? parseAddressCountries(JSON.parse(await fetchText(ADDR_BASE, 'addr_countries.json', cacheDir)));
  const out = new Map<string, Postal>();
  let next = 0;
  const worker = async () => {
    for (;;) {
      const cc = countries[next++];
      if (!cc) return;
      out.set(cc, parseAddressRecord(JSON.parse(await fetchText(`${ADDR_BASE}/${cc}`, `addr_${cc}.json`, cacheDir)), cc));
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return out;
}

export const DRIVING_QUERY = `SELECT ?cc ?sideLabel WHERE { ?c wdt:P297 ?cc . ?c p:P1622 ?st . ?st ps:P1622 ?side . ?st wikibase:rank ?rk . FILTER(?rk != wikibase:DeprecatedRank) FILTER NOT EXISTS { ?st pq:P582 [] } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
/** Current driving side per country; a country with conflicting statements is left out. */
export function parseDriving(rows: Binding[]): Map<string, 'left' | 'right'> {
  const sides = new Map<string, Set<string>>();
  for (const r of rows) {
    const cc = r.cc?.value;
    const side = r.sideLabel?.value;
    if (!cc || !/^[A-Z]{2}$/.test(cc) || (side !== 'left' && side !== 'right')) continue;
    (sides.get(cc) ?? sides.set(cc, new Set()).get(cc)!).add(side);
  }
  const out = new Map<string, 'left' | 'right'>();
  for (const [cc, s] of sides) if (s.size === 1) out.set(cc, [...s][0] as 'left' | 'right');
  if (out.size < 200) throw new Error(`Wikidata driving side: only ${out.size} countries — query result changed`);
  return out;
}

async function upsertSource(pool: pg.Pool, id: AttrSourceId): Promise<void> {
  const s = ATTR_SOURCES[id];
  await pool.query(
    `INSERT INTO sources (id, authority, url, license, attribution, cadence, license_verdict, commercial_use, source_class, retrieved_at)
     VALUES ($1, $2, $3, $4, $5, 'monthly', $6, $7, 'community', now())
     ON CONFLICT (id) DO UPDATE SET authority = EXCLUDED.authority, url = EXCLUDED.url, license = EXCLUDED.license, attribution = EXCLUDED.attribution, retrieved_at = now()`,
    [id, s.authority, s.url, s.license, s.attribution, s.verdict, s.commercial],
  );
}

type Row = { id: string; grp: string; data: unknown };
/** Replace the attribute rows of one source in a transaction and, when they differ from the previous load, write a release note. */
async function replaceAttributes(pool: pg.Pool, source: AttrSourceId, rows: Row[], vintage: string, codeOf: Map<string, string>): Promise<{ rows: number; release_note: number | null }> {
  const old = (await pool.query(`SELECT e.code, a.grp, a.data, a.vintage FROM entity_attributes a JOIN entities e ON e.id = a.entity_id WHERE a.source = $1`, [source])).rows as { code: string; grp: string; data: unknown; vintage: string | null }[];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM entity_attributes WHERE source = $1', [source]);
    for (const r of rows) await client.query(`INSERT INTO entity_attributes (entity_id, grp, data, source, vintage) VALUES ($1, $2, $3, $4, $5)`, [r.id, r.grp, JSON.stringify(r.data), source, vintage]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  let note: number | null = null;
  if (old.length) {
    const ch = attributeChanges(old, rows.map((r) => ({ code: codeOf.get(r.id)!, grp: r.grp, data: r.data })));
    const changed = Object.fromEntries(ch.map((c) => [c.code, c.groups]));
    const vintageChange = old[0]!.vintage !== null && old[0]!.vintage !== vintage;
    const snapshotId = await recordAttributeChanges(pool, source, ch, vintageChange ? `vintage_change: ${vintage}` : undefined).catch((e) => { console.error('attribute changes:', (e as Error).message); return null; });
    note = await createAttributeReleaseNote(pool, { source, authority: ATTR_SOURCES[source].authority, verdict: ATTR_SOURCES[source].verdict, vintageFrom: old[0]!.vintage, vintageTo: vintage, changed, localeChanges: 0, snapshotId }).catch((e) => { console.error('release note:', (e as Error).message); return null; });
  }
  return { rows: rows.length, release_note: note };
}

export interface ExternalResult { postal: { rows: number; release_note: number | null; vintage: string }; timezones: { rows: number; release_note: number | null; vintage: string }; telephony: { rows: number; release_note: number | null; vintage: string }; driving: { rows: number; release_note: number | null; vintage: string } }
/** Fetch IANA zone.tab, libphonenumber metadata and Wikidata driving sides and write them as country attribute groups `timezones`, `telephony`, `driving`. */
export async function enrichExternalAttributes(pool: pg.Pool, cacheDir: string, opts: { sparqlFn?: typeof sparql } = {}): Promise<ExternalResult> {
  const countries = (await pool.query(`SELECT id, code FROM entities WHERE kind = 'country'`)).rows as { id: string; code: string }[];
  const codeOf = new Map(countries.map((c) => [c.id, c.code]));
  for (const id of Object.keys(ATTR_SOURCES) as AttrSourceId[]) await upsertSource(pool, id);

  const zones = parseZoneTab(await fetchText(`${TZ_BASE}/zone.tab`, 'tz_zone.tab', cacheDir));
  const tzVersion = (await fetchText(`${TZ_BASE}/version`, 'tz_version.txt', cacheDir)).trim();
  if (!/^\d{4}[a-z]$/.test(tzVersion)) throw new Error(`tzdb version "${tzVersion.slice(0, 20)}" — layout changed`);
  const tz = await replaceAttributes(pool, 'iana-tz', countries.flatMap(({ id, code }) => (zones.has(code) ? [{ id, grp: 'timezones', data: { count: zones.get(code)!.length, ids: zones.get(code)!.map((z) => z.id), zones: zones.get(code) } }] : [])), `tzdb ${tzVersion}`, codeOf);

  const xml = await fetchText(PHONE_URL, 'libphonenumber_metadata.xml', cacheDir);
  const phones = parsePhoneMetadata(xml);
  const phoneVintage = 'libphonenumber master'; // a moving branch has no release number; a data change is reported by the content diff
  const tel = await replaceAttributes(pool, 'libphonenumber', countries.flatMap(({ id, code }) => (phones.has(code) ? [{ id, grp: 'telephony', data: phones.get(code)! }] : [])), phoneVintage, codeOf);

  const addr = await fetchAddressData(cacheDir);
  const post = await replaceAttributes(pool, 'libaddressinput', countries.flatMap(({ id, code }) => (addr.has(code) ? [{ id, grp: 'postal', data: addr.get(code)! }] : [])), 'libaddressinput', codeOf);

  const driving = parseDriving(await (opts.sparqlFn ?? sparql)(DRIVING_QUERY));
  const dr = await replaceAttributes(pool, 'wikidata-driving', countries.flatMap(({ id, code }) => (driving.has(code) ? [{ id, grp: 'driving', data: { side: driving.get(code)! } }] : [])), 'wikidata', codeOf);
  return { postal: { ...post, vintage: 'libaddressinput' }, timezones: { ...tz, vintage: `tzdb ${tzVersion}` }, telephony: { ...tel, vintage: phoneVintage }, driving: { ...dr, vintage: 'wikidata' } };
}

/** Contract check for check:sources: fetch and parse all three sources, write nothing. */
export async function checkExternalContract(cacheDir: string, opts: { sparqlFn?: typeof sparql } = {}): Promise<string> {
  const z = parseZoneTab(await fetchText(`${TZ_BASE}/zone.tab`, 'tz_zone.tab', cacheDir));
  const p = parsePhoneMetadata(await fetchText(PHONE_URL, 'libphonenumber_metadata.xml', cacheDir));
  const d = parseDriving(await (opts.sparqlFn ?? sparql)(DRIVING_QUERY));
  parseAddressCountries(JSON.parse(await fetchText(ADDR_BASE, 'addr_countries.json', cacheDir)));
  const a = await fetchAddressData(cacheDir, ['US', 'TR', 'DE']);
  return `tzdb ${z.size} countries, libphonenumber ${p.size} territories, driving side ${d.size} countries, address data ok (${a.size} sampled)`;
}
