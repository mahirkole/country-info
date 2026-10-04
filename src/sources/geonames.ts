import { fetchText } from './fetch.js';
import type { EntityInput, SourceMeta } from '../model.js';
import { unStatus } from './un.js';

export const GEONAMES: SourceMeta = {
  id: 'geonames',
  authority: 'GeoNames',
  url: 'https://download.geonames.org/export/dump/',
  license: 'Creative Commons Attribution (CC BY); commercial use allowed, credit required',
  attribution: 'Contains data from GeoNames (https://www.geonames.org), licensed under Creative Commons Attribution (CC BY).',
};

const BASE = 'https://download.geonames.org/export/dump';

export const fetchCached = (file: string, cacheDir: string, maxAgeMs?: number) =>
  fetchText(`${BASE}/${file}`, file, cacheDir, maxAgeMs);

const rows = (text: string) => text.split('\n').filter((l) => l.trim() !== '' && !l.startsWith('#')).map((l) => l.split('\t'));
const num = (s: string | undefined) => (s === undefined || s === '' || Number.isNaN(Number(s)) ? null : Number(s));
const list = (s: string | undefined) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);

/** countryInfo.txt -> country entities (one per ISO 3166-1 area GeoNames knows). */
export function parseCountryInfo(text: string): EntityInput[] {
  const out: EntityInput[] = [];
  for (const c of rows(text)) {
    const iso = c[0];
    if (!iso || iso.length !== 2 || !c[4]) continue;
    out.push({
      id: `country:${iso}`,
      kind: 'country',
      parent_id: null,
      country_code: iso,
      code: iso,
      name: c[4],
      name_ascii: null,
      lat: null,
      lon: null,
      data: {
        iso3: c[1] || null,
        numeric: c[2] || null,
        fips: c[3] || null,
        capital: c[5] || null,
        area_km2: num(c[6]),
        population: num(c[7]),
        continent: c[8] || null,
        tld: c[9] || null,
        currency: c[10] ? { code: c[10], name: c[11] || null } : null,
        phone_code: c[12] || null,
        postal_code: c[13] || c[14] ? { format: c[13] || null, regex: c[14] || null } : null,
        languages: list(c[15]),
        neighbours: list(c[17]),
        geonames_id: num(c[16]),
        un_status: unStatus(iso),
      },
    });
  }
  return out;
}

/** admin1CodesASCII.txt: `CC.A1 \t name \t asciiname \t geonameid` */
export function parseAdmin1(text: string): EntityInput[] {
  const out: EntityInput[] = [];
  for (const r of rows(text)) {
    const [code, name, ascii, gid] = r;
    if (!code || !name || !gid) continue;
    const cc = code.split('.')[0]!;
    out.push({
      id: `gn:${gid}`,
      kind: 'admin1',
      parent_id: `country:${cc}`,
      country_code: cc,
      code,
      name,
      name_ascii: ascii || null,
      lat: null,
      lon: null,
      data: { geonames_id: Number(gid) },
    });
  }
  return out;
}

/** admin2Codes.txt: `CC.A1.A2 \t name \t asciiname \t geonameid`; parent is the admin1 `CC.A1`. */
export function parseAdmin2(text: string, admin1ByCode: Map<string, string>): EntityInput[] {
  const out: EntityInput[] = [];
  for (const r of rows(text)) {
    const [code, name, ascii, gid] = r;
    if (!code || !name || !gid) continue;
    const parts = code.split('.');
    const cc = parts[0]!;
    const parent = admin1ByCode.get(`${cc}.${parts[1]}`);
    if (!parent) continue; // orphan admin2 (admin1 missing in source)
    out.push({
      id: `gn:${gid}`,
      kind: 'admin2',
      parent_id: parent,
      country_code: cc,
      code,
      name,
      name_ascii: ascii || null,
      lat: null,
      lon: null,
      data: { geonames_id: Number(gid) },
    });
  }
  return out;
}

export async function loadGeoNames(cacheDir: string, withAdmin2: boolean): Promise<EntityInput[]> {
  const countries = parseCountryInfo(await fetchCached('countryInfo.txt', cacheDir));
  const known = new Set(countries.map((c) => c.country_code));
  const admin1 = parseAdmin1(await fetchCached('admin1CodesASCII.txt', cacheDir)).filter((e) => known.has(e.country_code));
  const all = [...countries, ...admin1];
  if (withAdmin2) {
    const byCode = new Map(admin1.map((e) => [e.code!, e.id]));
    all.push(...parseAdmin2(await fetchCached('admin2Codes.txt', cacheDir), byCode));
  }
  return all;
}
