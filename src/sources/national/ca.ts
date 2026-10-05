import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { parseCsv } from '../csv.js';
import { division, type NationalSource } from './types.js';

const URL = 'https://www.statcan.gc.ca/en/statistical-programs/document/sgc-cgt-2021-structure-eng.csv';

const TYPES: Record<string, { type: string; local: string }> = {
  '1': { type: 'region', local: 'geographical region' },
  '2': { type: 'province', local: 'province or territory' },
  '3': { type: 'district', local: 'census division' },
  '4': { type: 'municipality', local: 'census subdivision' },
};

/**
 * Statistics Canada SGC 2021 structure: region (1 digit) > province/territory (2) > census division (4) >
 * census subdivision (7). Parents follow from the code prefixes (`1001101` > `1001` > `10` > `1`).
 */
export function parseSgc(rows: Record<string, string>[]): EntityInput[] {
  const out: EntityInput[] = [];
  const ids = new Set<string>();
  for (const r of rows) {
    const level = r['Level'];
    const code = r['Code'];
    const t = level ? TYPES[level] : undefined;
    if (!t || !code) continue;
    const parentCode = level === '1' ? null : level === '2' ? code.slice(0, 1) : level === '3' ? code.slice(0, 2) : code.slice(0, 4);
    const parent = parentCode ? `div:CA:${parentCode}` : 'country:CA';
    ids.add(`div:CA:${code}`);
    out.push(division('CA', code, { parent, name: r['Class title'] ?? code, level: Number(level), type: t.type, typeLocal: t.local, extra: { sgc: code } }));
  }
  return out;
}

export const CA: NationalSource = {
  country: 'CA',
  meta: {
    id: 'nat-ca',
    authority: 'Statistics Canada – Standard Geographical Classification (SGC) 2021',
    url: URL,
    license: 'Statistics Canada Open Licence (read): use, sale, value-added products and sublicensing permitted; required attribution "Adapted from Statistics Canada…This does not constitute an endorsement by Statistics Canada of this product" (docs/licenses/nat-ca.md). SGC pages carry no licence mark of their own; the licence covers "most" data products.',
    version: 'SGC 2021',
    attribution: 'Adapted from Statistics Canada, Standard Geographical Classification (SGC) 2021. This does not constitute an endorsement by Statistics Canada of this product.',
  },
  licenseStatus: 'read',
  levels: ['region', 'province/territory', 'census division', 'census subdivision'],
  async load(cacheDir) {
    return parseSgc(parseCsv(await fetchText(URL, 'ca_sgc_structure.csv', cacheDir)));
  },
};
