import type { EntityInput } from '../../model.js';
import { fetchBytes } from '../fetch.js';
import { readXlsx, type Sheet } from '../xlsx.js';
import { division, type NationalSource } from './types.js';

const URL = 'https://statistiques.public.lu/dam-assets/fr/donnees-autres-formats/territoire-environ-energie/territoire/A1106.xlsx';

/**
 * STATEC "codes LAU des communes" workbook (data.public.lu, CC0): the sheet after `Index` that has the header row
 * "NUTS 3 - CODE REGION | LAU1 - CODE CANTON | CANTON | LAU2 - CODE COMMUNE | COMMUNE" is the current list (its name carries the
 * reference date, e.g. "LU_SEP 2023", and changes with each edition; older editions follow as further sheets).
 * Cantons (LAU1, 12) hang under the country, communes (LAU2, 100) under their canton.
 */
export function parseLuxembourg(sheets: Sheet[]): { entities: EntityInput[]; asOf: string } {
  const sheet = sheets.find((s) => s.name !== 'Index' && (s.rows[0]?.[0] ?? '').startsWith('NUTS 3') && (s.rows[0]?.[3] ?? '').startsWith('LAU2'));
  if (!sheet) throw new Error('STATEC LAU workbook: no sheet with the NUTS 3 / LAU1 / LAU2 header row — layout changed');
  const out: EntityInput[] = [];
  const cantons = new Set<string>();
  const communes = new Set<string>();
  for (const r of sheet.rows.slice(1)) {
    const [nuts, cantonCode, canton, communeCode, commune] = r.map((c) => (c ?? '').trim());
    if (!/^\d{4}$/.test(communeCode ?? '') || !commune || !/^\d{2}$/.test(cantonCode ?? '') || !canton) continue; // second header line, blanks
    if (!cantons.has(cantonCode!)) {
      cantons.add(cantonCode!);
      out.push(division('LU', `can-${cantonCode}`, { parent: 'country:LU', name: canton, level: 1, type: 'canton', typeLocal: 'canton', extra: { lau1: cantonCode, nuts3: nuts } }));
    }
    if (communes.has(communeCode!)) throw new Error(`STATEC LAU workbook: duplicate commune code ${communeCode}`);
    communes.add(communeCode!);
    out.push(division('LU', `com-${communeCode}`, { parent: `div:LU:can-${cantonCode}`, name: commune, level: 2, type: 'commune', typeLocal: 'commune', extra: { lau2: communeCode } }));
  }
  if (cantons.size !== 12 || communes.size < 95 || communes.size > 105) throw new Error(`STATEC LAU workbook: ${cantons.size} cantons and ${communes.size} communes (the workbook states 12 cantons, 100 communes) — layout changed`);
  return { entities: out, asOf: sheet.name };
}

export const LU: NationalSource = {
  country: 'LU',
  meta: {
    id: 'nat-lu',
    authority: 'STATEC (Institut national de la statistique et des études économiques du Grand-Duché de Luxembourg) – codes LAU des communes',
    url: 'https://data.public.lu/en/datasets/codes-lau-des-communes-du-grand-duche-de-luxembourg/',
    license: 'Creative Commons Zero (CC0): the data.public.lu dataset page states "License Creative Commons Zero (CC0)" and the portal footer "Unless otherwise stated, all content of this site is available under Creative Commons CC0 license." (read 2026-10-06, docs/licenses/nat-lu.md)',
    attribution: 'Source: STATEC, LAU codes of the communes of Luxembourg (data.public.lu, CC0)',
  },
  licenseStatus: 'read',
  levels: ['canton', 'commune'],
  async load(cacheDir) {
    const { entities } = parseLuxembourg(readXlsx(await fetchBytes(URL, 'lu_statec_lau.xlsx', cacheDir)));
    return entities;
  },
};
