import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { division, type NationalSource } from './types.js';

const SEARCH = 'https://www.arcgis.com/sharing/rest/search';
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

type Row = Record<string, unknown>;
interface Item { id: string; title: string; url?: string }

/** "Local Authority Districts (April 2025) Names and Codes in the UK (V2)" -> sortable key (year*100+month, then V). */
export function itemKey(title: string): number {
  const m = /\(([A-Za-z]+) (\d{4})\)/.exec(title);
  const mo = m ? MONTHS.indexOf(m[1]!.toLowerCase()) : -1;
  if (!m || mo < 0) return -1;
  const v = /\(V(\d+)\)/i.exec(title);
  return (Number(m[2]) * 100 + mo + 1) * 100 + (v ? Number(v[1]) : 1);
}

/** Newest ONS item whose title matches `re` (case-insensitive); throws if the portal returned none. */
export function pickLatestItem(items: Item[], re: RegExp): Item {
  const c = items.filter((i) => i.url && re.test(i.title)).sort((a, b) => itemKey(b.title) - itemKey(a.title));
  if (!c[0] || itemKey(c[0].title) < 0) throw new Error(`ONS: no item matched ${re}`);
  return c[0];
}

export interface OnsTables {
  countries: Row[];
  regions: Row[];
  ladRegion: Row[];
  ladCtyua: Row[];
  lads: Row[];
}

const ctry = (code: string) => (code.startsWith('E') ? 'E92000001' : code.startsWith('W') ? 'W92000004' : code.startsWith('S') ? 'S92000003' : 'N92000002');
const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
/** The year-suffixed field (LAD25CD, RGN25NM ...) whichever vintage the table is. */
const field = (r: Row, prefix: string, suffix: string): string | null => {
  for (const k of Object.keys(r)) if (k.startsWith(prefix) && k.endsWith(suffix) && /\d\d/.test(k.slice(prefix.length, k.length - suffix.length))) return s(r[k]);
  return null;
};

/**
 * ONS Open Geography: nation (England/Wales/Scotland/Northern Ireland) > region (England only) > local authority district.
 * County / unitary-authority parent is kept as an attribute (lookup tables), not as a level, because unitary authorities
 * are both a county-or-UA and a district under the same code.
 */
export function mapOns(t: OnsTables): EntityInput[] {
  const out: EntityInput[] = [];
  const nations = new Set<string>();
  for (const r of t.countries) {
    const code = field(r, 'CTRY', 'CD');
    const name = field(r, 'CTRY', 'NM');
    if (!code || !name || code.startsWith('K')) continue; // K02000001 = the UK itself
    nations.add(code);
    out.push(division('GB', code, { parent: 'country:GB', name, level: 1, type: 'region', typeLocal: 'country of the UK', extra: { gss: code, name_cy: field(r, 'CTRY', 'NMW') } }));
  }
  if (!nations.size) throw new Error('ONS countries table empty or layout changed');
  const regions = new Set<string>();
  for (const r of t.regions) {
    const code = field(r, 'RGN', 'CD');
    const name = field(r, 'RGN', 'NM');
    if (!code || !name) continue;
    regions.add(code);
    out.push(division('GB', code, { parent: 'div:GB:E92000001', name, level: 2, type: 'region', typeLocal: 'region of England', extra: { gss: code, name_cy: field(r, 'RGN', 'NMW') } }));
  }
  const region = new Map<string, string>();
  for (const r of t.ladRegion) {
    const l = field(r, 'LAD', 'CD');
    const g = field(r, 'RGN', 'CD');
    if (l && g && regions.has(g)) region.set(l, g);
  }
  const ctyua = new Map<string, { code: string; name: string | null }>();
  for (const r of t.ladCtyua) {
    const l = field(r, 'LAD', 'CD');
    const c = field(r, 'CTYUA', 'CD');
    if (l && c) ctyua.set(l, { code: c, name: field(r, 'CTYUA', 'NM') });
  }
  const seen = new Set<string>();
  for (const r of t.lads) {
    const code = field(r, 'LAD', 'CD');
    const name = field(r, 'LAD', 'NM');
    if (!code || !name || seen.has(code)) continue;
    seen.add(code);
    const n = ctry(code);
    const reg = region.get(code);
    const cu = ctyua.get(code);
    out.push(division('GB', code, {
      parent: `div:GB:${reg ?? n}`, name, level: reg ? 3 : 2, type: 'district', typeLocal: 'local authority district',
      extra: { gss: code, name_cy: field(r, 'LAD', 'NMW'), ...(cu ? { county_ua_code: cu.code, county_ua_name: cu.name } : {}) },
    }));
  }
  if (seen.size < 300) throw new Error(`ONS: only ${seen.size} local authority districts — layout changed`);
  return out;
}

async function search(extra: string, cacheDir: string, name: string): Promise<Item[]> {
  const q = new URLSearchParams({ q: `owner:ONSGeography_data AND ${extra}`, num: '50', sortField: 'modified', sortOrder: 'desc', f: 'json' });
  return (JSON.parse(await fetchText(`${SEARCH}?${q}`, name, cacheDir)) as { results?: Item[] }).results ?? [];
}

async function rows(item: Item, cacheDir: string, name: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const q = new URLSearchParams({ where: '1=1', outFields: '*', orderByFields: 'ObjectId', resultOffset: String(offset), resultRecordCount: '1000', f: 'json' });
    const page = JSON.parse(await fetchText(`${item.url}/0/query?${q}`, `${name}_${offset}.json`, cacheDir)) as { features?: { attributes: Row }[]; exceededTransferLimit?: boolean; error?: unknown };
    if (page.error || !page.features) throw new Error(`ONS ${item.title}: ${JSON.stringify(page.error ?? 'no features')}`);
    out.push(...page.features.map((f) => f.attributes));
    if (!page.exceededTransferLimit && page.features.length < 1000) break;
  }
  return out;
}

export const GB: NationalSource = {
  country: 'GB',
  meta: {
    id: 'nat-gb',
    authority: 'Office for National Statistics – Open Geography Portal (Names and Codes in the UK, lookups)',
    url: 'https://geoportal.statistics.gov.uk/',
    license: 'Open Government Licence v3.0 (read, docs/licenses/nat-gb.md): commercial and non-commercial use, distribution, adaptation; attribution required. Names-and-codes tables carry no OS/Royal Mail data; postcodes, UPRN and Northern Ireland postcode data are NOT taken. Partial: ONS page does not name these tables in its lookup category.',
    version: 'ONS (latest vintage)',
    attribution: 'Source: Office for National Statistics licensed under the Open Government Licence v.3.0',
  },
  licenseStatus: 'partial',
  levels: ['nation', 'region (England)', 'local authority district'],
  async load(cacheDir) {
    const find = async (phrase: string, re: RegExp, tag: string) => pickLatestItem(await search(phrase.split(' ').map((w) => `title:${w}`).join(' AND '), cacheDir, `gb_search_${tag}.json`), re);
    const lad = await find('Local Authority Districts Names and Codes in the UK', /^Local Authority Districts \(.*Names and Codes in the UK/i, 'lad');
    const countries = await find('Countries Names and Codes in the UK', /^Countries \(.*Names and Codes in the UK/i, 'ctry');
    const regions = await find('Regions Names and Codes in EN', /^Regions \(.*Names and Codes in EN/i, 'rgn');
    const ladRegion = await find('Local Authority District to Region Lookup in EN', /^Local Authority District to Region \(.*Lookup in EN/i, 'lad_rgn');
    const ladCtyua = await find('Local Authority District to County and Unitary Authority Lookup in the UK', /^Local Authority District to County and Unitary Authority \(.*Lookup in (the )?UK/i, 'lad_ctyua');
    this.meta.version = `ONS ${lad.title.match(/\(([A-Za-z]+ \d{4})\)/)?.[1] ?? 'latest'}`;
    return mapOns({
      countries: await rows(countries, cacheDir, 'gb_ctry'),
      regions: await rows(regions, cacheDir, 'gb_rgn'),
      ladRegion: await rows(ladRegion, cacheDir, 'gb_lad_rgn'),
      ladCtyua: await rows(ladCtyua, cacheDir, 'gb_lad_ctyua'),
      lads: await rows(lad, cacheDir, 'gb_lad'),
    });
  },
};
