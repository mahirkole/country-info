import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { division, type NationalSource } from './types.js';

const API = 'https://statistikdatabasen.scb.se/api/v2';
const SEARCH = 'population by region'; // SCB's search is word based; commas return nothing
const QUERY = 'Population by region, country of birth and sex'; // label prefix of the yearly series

interface TableInfo { id: string; label: string; lastPeriod?: string; updated?: string }
interface Metadata { dimension: { Region?: { label: string; category: { index: Record<string, number> | string[]; label: Record<string, string> } } } }

/** The newest yearly table of the series (SCB publishes a new table id each year, e.g. TAB6646 for 2025). */
export function pickLatestTable(tables: TableInfo[]): TableInfo {
  const series = tables.filter((t) => t.label.startsWith(QUERY) && /^Year \d{4}$/.test(t.label.split('.').pop()!.trim()));
  const best = series.sort((a, b) => Number(b.lastPeriod ?? 0) - Number(a.lastPeriod ?? 0) || (b.updated ?? '').localeCompare(a.updated ?? ''))[0];
  if (!best) throw new Error(`no SCB table found for "${QUERY}"`);
  return best;
}

function regionLabels(meta: Metadata): Map<string, string> {
  const r = meta.dimension.Region;
  if (!r) throw new Error('SCB table has no Region dimension');
  const codes = Array.isArray(r.category.index) ? r.category.index : Object.keys(r.category.index);
  return new Map(codes.map((c) => [c, r.category.label[c] ?? c]));
}

/** 2-digit codes are counties (län), 4-digit codes municipalities (kommun); `00` is the whole country. */
export function mapSweden(sv: Metadata, en: Metadata): EntityInput[] {
  const svL = regionLabels(sv);
  const enL = regionLabels(en);
  const out: EntityInput[] = [];
  for (const [code, name] of svL) {
    if (code === '00') continue;
    const extra = { scb: code, name_en: enL.get(code) ?? null };
    if (/^\d{2}$/.test(code)) out.push(division('SE', `lan-${code}`, { parent: 'country:SE', name, level: 1, type: 'county', typeLocal: 'län', extra }));
    else if (/^\d{4}$/.test(code)) out.push(division('SE', `kommun-${code}`, { parent: `div:SE:lan-${code.slice(0, 2)}`, name, level: 2, type: 'municipality', typeLocal: 'kommun', extra }));
  }
  return out;
}

export const SE: NationalSource = {
  country: 'SE',
  meta: {
    id: 'nat-se',
    authority: 'Statistics Sweden (SCB) – Statistical Database, region codes (PxWebApi v2)',
    url: `${API}/tables`,
    license: 'CC0 1.0 (SCB open data page, read: "We use the licence CC0 for this data, which means that you may use and disseminate or provide such data without any requirement to state the source"; the API config repeats the CC0 URL)',
    version: 'SCB region table series (see sources.version after first run)',
    attribution: 'Source: Statistics Sweden (SCB). Attribution is not required (CC0) but recommended.',
  },
  licenseStatus: 'read',
  levels: ['county (län)', 'municipality (kommun)'],
  async load(cacheDir) {
    const list = JSON.parse(await fetchText(`${API}/tables?query=${encodeURIComponent(SEARCH)}&lang=en&pageSize=50`, 'se_tables.json', cacheDir)) as { tables: TableInfo[] };
    const t = pickLatestTable(list.tables);
    const get = async (lang: string) => JSON.parse(await fetchText(`${API}/tables/${t.id}/metadata?lang=${lang}`, `se_${t.id}_${lang}.json`, cacheDir)) as Metadata;
    this.meta.version = `SCB ${t.id} (${t.lastPeriod ?? '?'})`;
    return mapSweden(await get('sv'), await get('en'));
  },
};
