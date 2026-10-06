import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { division, type NationalSource } from './types.js';

const API = 'https://data.stat.fi/api/classifications/v2/classifications';
const MAPS = (kunta: string, maakunta: string) => `https://api.stat.fi/classificationservice/open/api/classifications/v2/correspondenceTables/${kunta}%23${maakunta}/maps`;

interface Item { code?: string; parentCode?: string | null; classificationItemNames?: { lang: string; name: string }[] }

/** Newest edition (`<series>_1_YYYYMMDD`) that is already in force on `today`. */
export function latestEdition(list: unknown, series: 'kunta' | 'maakunta', today = new Date()): string {
  const ids = (Array.isArray(list) ? list : []).map((x) => (x as { localId?: string }).localId ?? '').filter((id) => new RegExp(`^${series}_1_\\d{8}$`).test(id));
  const stamp = today.toISOString().slice(0, 10).replace(/-/g, '');
  const valid = ids.filter((id) => id.slice(-8) <= stamp).sort();
  if (!valid.length) throw new Error(`Statistics Finland classification list: no ${series}_1 edition — layout changed`);
  return valid.at(-1)!;
}

/**
 * Statistics Finland classification service: `kunta_1_<date>` (municipalities) and `maakunta_1_<date>` (regions). The correspondence table's
 * data endpoint has been answering HTTP 500; its `/maps` listing (no query) works and encodes `<kunta>/<maakunta>` in each URL, which gives the parent.
 */
export function parseFinland(kunta: Item[], maakunta: Item[], maps: string[], swedish: Item[] = []): EntityInput[] {
  const name = (i: Item, lang = 'fi') => i.classificationItemNames?.find((n) => n.lang === lang)?.name ?? i.classificationItemNames?.[0]?.name ?? '';
  const sv = new Map(swedish.map((i) => [i.code, name(i, 'sv')]));
  const parentOf = new Map<string, string>();
  for (const u of maps) {
    const m = /\/maps\/([^/]+)\/([^/?#]+)$/.exec(u);
    if (m) parentOf.set(decodeURIComponent(m[1]!), decodeURIComponent(m[2]!));
  }
  const out: EntityInput[] = [];
  const regions = new Set<string>();
  for (const r of maakunta) {
    if (!r.code || !/^\d{2}$/.test(r.code) || !name(r)) throw new Error('Statistics Finland maakunta item: unexpected shape — layout changed');
    regions.add(r.code);
    out.push(division('FI', `mk-${r.code}`, { parent: 'country:FI', name: name(r), level: 1, type: 'region', typeLocal: 'maakunta', extra: { stat_fi: r.code } }));
  }
  for (const k of kunta) {
    if (!k.code || !/^\d{3}$/.test(k.code) || !name(k)) throw new Error('Statistics Finland kunta item: unexpected shape — layout changed');
    const p = parentOf.get(k.code);
    if (!p || !regions.has(p)) throw new Error(`Statistics Finland: kunta ${k.code} has no maakunta in the correspondence list — layout changed`);
    const svName = sv.get(k.code);
    out.push(division('FI', `kunta-${k.code}`, { parent: `div:FI:mk-${p}`, name: name(k), level: 2, type: 'municipality', typeLocal: 'kunta', extra: { stat_fi: k.code, ...(svName && svName !== name(k) ? { name_sv: svName } : {}) } }));
  }
  if (regions.size < 15 || regions.size > 22 || kunta.length < 290 || kunta.length > 330) throw new Error(`Statistics Finland: ${regions.size} maakunta and ${kunta.length} kunta (expected 19 and about 308) — layout changed`);
  return out;
}

export const FI: NationalSource = {
  country: 'FI',
  meta: {
    id: 'nat-fi',
    authority: 'Tilastokeskus / Statistics Finland – classifications of municipalities (kunta) and regions (maakunta)',
    url: 'https://stat.fi/en/luokitukset/kunta',
    license: 'Statistics Finland terms of use (read 2026-10-06, docs/licenses/nat-fi.md): "Statistics Finland\'s open data materials and public content of the web service are covered by the Creative Commons Attribution 4.0 International licence." and "You can also combine the data with other data and use the data for commercial purposes as well." (data of other organisations excluded)',
    attribution: 'Source: Statistics Finland (CC BY 4.0)',
  },
  licenseStatus: 'read',
  levels: ['maakunta', 'kunta'],
  async load(cacheDir) {
    const list = JSON.parse(await fetchText(`${API}?content=data&meta=min`, 'fi_stat_classifications.json', cacheDir));
    const [k, m] = [latestEdition(list, 'kunta'), latestEdition(list, 'maakunta')];
    const items = async (id: string, lang: string) => JSON.parse(await fetchText(`${API}/${id}/classificationItems?content=data&meta=max&lang=${lang}`, `fi_stat_${id}_${lang}.json`, cacheDir)) as Item[];
    const maps = JSON.parse(await fetchText(MAPS(k, m), `fi_stat_maps_${k}_${m}.json`, cacheDir)) as string[];
    return parseFinland(await items(k, 'fi'), await items(m, 'fi'), maps, await items(k, 'sv'));
  },
};
