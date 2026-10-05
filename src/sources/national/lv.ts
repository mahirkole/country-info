import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { parseCsv } from '../csv.js';
import { division, type NationalSource } from './types.js';

const PACKAGE = 'https://data.gov.lv/dati/api/3/action/package_show?id=atvk';

interface CkanResource { name: string; url: string; format?: string }

/** The newest "ATVK_2021_<ddmmyyyy>" resource of the CSB dataset (the file is re-published with every territorial change). */
export function pickAtvk(resources: CkanResource[]): CkanResource {
  const dated = resources
    .map((r) => ({ r, m: /^ATVK_2021_(\d\d)(\d\d)(\d{4})$/.exec(r.name) }))
    .filter((x) => x.m)
    .sort((a, b) => `${b.m![3]}${b.m![2]}${b.m![1]}`.localeCompare(`${a.m![3]}${a.m![2]}${a.m![1]}`));
  if (!dated[0]) throw new Error('data.gov.lv ATVK: no ATVK_2021_<date> resource — layout changed');
  return dated[0].r;
}

/**
 * Central Statistical Bureau ATVK (administrative territories and populated places) 2021 classifier: local governments
 * (7 state cities + novadi) with the towns (pilsētas) and parishes (pagasti) below them. Only rows without `ValidTo` are current.
 */
export function mapAtvk(rows: Record<string, string>[]): EntityInput[] {
  const cur = rows.filter((r) => r['Code'] && r['Name'] && !r['ValidTo']);
  const tops = cur.filter((r) => !r['ParentCode']);
  const topCodes = new Set(tops.map((r) => r['Code']!));
  const out: EntityInput[] = [];
  for (const r of tops) {
    out.push(division('LV', r['Code']!, { parent: 'country:LV', name: r['Name']!, level: 1, type: 'municipality', typeLocal: /novads$/.test(r['Name']!) ? 'novads' : 'valstspilsētas pašvaldība', extra: { atvk: r['Code']! } }));
  }
  let sub = 0;
  for (const r of cur) {
    const parent = r['ParentCode'];
    if (!parent) continue;
    if (!topCodes.has(parent)) throw new Error(`ATVK: ${r['Code']} ${r['Name']} has unknown parent ${parent}`);
    const parish = /pagasts$/.test(r['Name']!);
    sub++;
    out.push(division('LV', r['Code']!, { parent: `div:LV:${parent}`, name: r['Name']!, level: 2, type: parish ? 'parish' : 'town', typeLocal: parish ? 'pagasts' : 'pilsēta', extra: { atvk: r['Code']! } }));
  }
  if (tops.length < 40 || tops.length > 45 || sub < 450) throw new Error(`ATVK: ${tops.length} local governments / ${sub} towns and parishes — layout changed`);
  return out;
}

export const LV: NationalSource = {
  country: 'LV',
  meta: {
    id: 'nat-lv',
    authority: 'Centrālā statistikas pārvalde (CSB) – ATVK classifier, via data.gov.lv',
    url: 'https://data.gov.lv/dati/dataset/atvk',
    license: 'CSB statistics dissemination policy (read 2026-10-05, docs/licenses/nat-lv.md): "…var izmantot nekomerciāliem un komerciāliem mērķiem, norādot atsauci uz datu avotu… atbilst… Creative Commons, CC 4.0 BY"; data.gov.lv metadata for the dataset states CC0 1.0 (publisher: Centrālā statistikas pārvalde). The stricter CC BY is applied.',
    version: 'ATVK 2021 (latest)',
    attribution: 'Avots: Centrālā statistikas pārvalde (CSP), Administratīvo teritoriju un teritoriālo vienību klasifikators (ATVK) (CC BY 4.0)',
  },
  licenseStatus: 'read',
  levels: ['pašvaldība (novads / valstspilsēta)', 'pilsēta / pagasts'],
  async load(cacheDir) {
    const pkg = JSON.parse(await fetchText(PACKAGE, 'lv_atvk_package.json', cacheDir)) as { result?: { resources?: CkanResource[] } };
    const res = pickAtvk(pkg.result?.resources ?? []);
    this.meta.version = res.name.replace('ATVK_2021_', 'ATVK 2021, file of ').replace(/(\d\d)(\d\d)(\d{4})$/, '$1.$2.$3');
    return mapAtvk(parseCsv(await fetchText(res.url, 'lv_atvk.csv', cacheDir)));
  },
};
