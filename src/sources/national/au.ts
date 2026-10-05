import type { EntityInput } from '../../model.js';
import { fetchBytes } from '../fetch.js';
import { readXlsx } from '../xlsx.js';
import { division, type NationalSource } from './types.js';

// ASGS Edition 4 (July 2026 – June 2031) allocation file: one row per SA2 with its SA3, SA4, GCCSA and State.
const URL = 'https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-4-july-2026-june-2031/access-and-downloads/allocation-files/SA2_2026_AUST.xlsx';

/**
 * ABS Main Structure: State/Territory > SA4 > SA3 > SA2. GCCSA (greater capital city statistical areas) is a
 * non-nested alternative grouping and is kept as an attribute of the SA4. LGAs are not part of this file
 * (they are mesh-block based and flagged "should not be used for legal purposes") and are not taken.
 */
export function parseAsgs(rows: string[][]): EntityInput[] {
  const [header, ...body] = rows;
  if (!header) return [];
  const col = (re: RegExp) => {
    const i = header.findIndex((h) => re.test(h));
    if (i < 0) throw new Error(`ASGS sheet has no column matching ${re} (layout changed)`);
    return i;
  };
  const c = {
    sa2: col(/^SA2_CODE_/), sa2n: col(/^SA2_NAME_/), sa3: col(/^SA3_CODE_/), sa3n: col(/^SA3_NAME_/), sa4: col(/^SA4_CODE_/), sa4n: col(/^SA4_NAME_/),
    gccsa: col(/^GCCSA_CODE_/), gccsan: col(/^GCCSA_NAME_/), ste: col(/^STATE_CODE_/), sten: col(/^STATE_NAME_/), area: header.findIndex((h) => /^AREA_ALBERS_SQKM/.test(h)),
  };
  const out: EntityInput[] = [];
  const seen = new Set<string>();
  const add = (e: EntityInput) => {
    if (!seen.has(e.id)) (seen.add(e.id), out.push(e));
  };
  const t = (r: string[], i: number) => (r[i] ?? '').trim();
  for (const r of body) {
    if (!t(r, c.sa2)) continue;
    add(division('AU', `ste-${t(r, c.ste)}`, { parent: 'country:AU', name: t(r, c.sten), level: 1, type: 'state', typeLocal: 'State or Territory', extra: { asgs: t(r, c.ste) } }));
    add(division('AU', `sa4-${t(r, c.sa4)}`, { parent: `div:AU:ste-${t(r, c.ste)}`, name: t(r, c.sa4n), level: 2, type: 'region', typeLocal: 'Statistical Area Level 4', extra: { asgs: t(r, c.sa4), gccsa: t(r, c.gccsa), gccsa_name: t(r, c.gccsan) } }));
    add(division('AU', `sa3-${t(r, c.sa3)}`, { parent: `div:AU:sa4-${t(r, c.sa4)}`, name: t(r, c.sa3n), level: 3, type: 'district', typeLocal: 'Statistical Area Level 3', extra: { asgs: t(r, c.sa3) } }));
    const area = c.area >= 0 ? Number(t(r, c.area)) : NaN;
    add(division('AU', `sa2-${t(r, c.sa2)}`, { parent: `div:AU:sa3-${t(r, c.sa3)}`, name: t(r, c.sa2n), level: 4, type: 'district', typeLocal: 'Statistical Area Level 2', extra: { asgs: t(r, c.sa2), area_km2: Number.isFinite(area) ? Math.round(area * 100) / 100 : null } }));
  }
  return out;
}

export const AU: NationalSource = {
  country: 'AU',
  meta: {
    id: 'nat-au',
    authority: 'Australian Bureau of Statistics (ABS) – Australian Statistical Geography Standard (ASGS) Edition 4',
    url: URL,
    license: 'ABS website copyright page (read): "All material presented on this website is provided under a Creative Commons Attribution 4.0 International licence", except the Coat of Arms, ABS logo, microdata and third-party content (docs/licenses/nat-au.md). Only the ABS-defined Main Structure is used; LGA (Non ABS structure) is not.',
    version: 'ASGS Edition 4 (current)',
    attribution: 'Source: Australian Bureau of Statistics (ABS), Australian Statistical Geography Standard (ASGS) Edition 4. Licensed under CC BY 4.0. Changes made.',
  },
  licenseStatus: 'read',
  levels: ['State/Territory', 'SA4', 'SA3', 'SA2'],
  async load(cacheDir) {
    const sheet = readXlsx(await fetchBytes(URL, 'au_sa2.xlsx', cacheDir))[0];
    if (!sheet) throw new Error('ABS workbook has no sheets');
    this.meta.version = `ASGS Edition 4 ${sheet.name}`;
    return parseAsgs(sheet.rows);
  },
};
