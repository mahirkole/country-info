import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { parseCsv } from '../csv.js';
import { division, type NationalSource } from './types.js';

const URL = 'https://csu.gov.cz/docs/107516/f1a13e13-9af2-462b-4b9e-2f0aee9997c6/struktura_uzemi_cr.csv?version=1.2';

/**
 * ČSÚ "Struktura území ČR": one row per obec with its okres (district), kraj (region, NUTS 3) and
 * region soudržnosti (cohesion region, NUTS 2). ORP/POU administrative layers are not taken.
 * Hierarchy: region soudržnosti > kraj > okres > obec.
 */
export function parseCzso(rows: Record<string, string>[]): EntityInput[] {
  const out: EntityInput[] = [];
  const seen = new Set<string>();
  const add = (e: EntityInput) => {
    if (!seen.has(e.id)) (seen.add(e.id), out.push(e));
  };
  for (const r of rows) {
    const obec = r['obec_kod'];
    const okres = r['okres_csu_cis101_lau_kod'];
    const kraj = r['kraj_csu_cis108_nuts_kod'];
    const reg = r['region_csu_cis107_nuts_kod'];
    if (!obec || !okres || !kraj || !reg) continue;
    add(division('CZ', `reg-${reg}`, { parent: 'country:CZ', name: r['region_text'] ?? reg, level: 1, type: 'region', typeLocal: 'region soudržnosti', extra: { nuts: reg, ruian: r['region_ruian_kod'] || null } }));
    add(division('CZ', `kraj-${kraj}`, { parent: `div:CZ:reg-${reg}`, name: r['kraj_text'] ?? kraj, level: 2, type: 'region', typeLocal: 'kraj', extra: { nuts: kraj, abbreviation: r['kraj_zkratka'] || null, ruian: r['kraj_ruian_vusc_kod'] || null } }));
    add(division('CZ', `okres-${okres}`, { parent: `div:CZ:kraj-${kraj}`, name: r['okres_text'] ?? okres, level: 3, type: 'district', typeLocal: 'okres', extra: { lau1: okres, nuts: r['okres_csu_cis109_nuts_kod'] || null, ruian: r['okres_ruian_kod'] || null } }));
    add(division('CZ', `obec-${obec}`, { parent: `div:CZ:okres-${okres}`, name: r['obec_text'] ?? obec, level: 4, type: 'municipality', typeLocal: r['obec_typ']?.toLowerCase() || 'obec', extra: { ruian_code: obec, valid_from: r['platnost_datum'] || null } }));
  }
  return out;
}

export const CZ: NationalSource = {
  country: 'CZ',
  meta: {
    id: 'nat-cz',
    authority: 'Czech Statistical Office (ČSÚ) – Struktura území ČR (číselníky)',
    url: URL,
    license: 'CC BY 4.0 (ČSÚ: "Statistické informace… zveřejněné prostřednictvím internetových stránek https://csu.gov.cz jsou licencovány v souladu s CC BY 4.0"; docs/licenses/nat-cz.md). Dataset-level confirmation and API attribution form pending.',
    version: 'ČSÚ Struktura území (current)',
    attribution: 'Zdroj: Český statistický úřad (CC BY 4.0).',
  },
  licenseStatus: 'read',
  levels: ['region soudržnosti (NUTS 2)', 'kraj (NUTS 3)', 'okres', 'obec'],
  async load(cacheDir) {
    const rows = parseCsv(await fetchText(URL, 'cz_struktura.csv', cacheDir));
    const date = rows[0]?.['platnost_datum'];
    this.meta.version = `ČSÚ Struktura území ${date ?? '?'}`;
    return parseCzso(rows);
  },
};
