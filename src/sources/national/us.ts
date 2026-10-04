import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { division, type NationalSource } from './types.js';

const BASE = 'https://www2.census.gov/geo/docs/reference/codes2020';

const rows = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean).slice(1).map((l) => l.split('|'));

/** national_state2020.txt: STATE|STATEFP|STATENS|STATE_NAME (states, DC and territories). */
export function parseStates(text: string): EntityInput[] {
  return rows(text).flatMap(([abbr, fp, , name]) =>
    fp && name
      ? [division('US', fp, { parent: 'country:US', name, level: 1, type: Number(fp) <= 56 ? 'state' : 'territory', typeLocal: Number(fp) <= 56 ? 'State' : 'Territory', extra: { postal: abbr, code_system: 'FIPS 5-2' } })]
      : [],
  );
}

/** Census class code -> unit type (H1 county, H4/H5 borough or census area, H6 consolidated/other, C7 independent city). */
function countyType(name: string, classfp: string): { type: string; local: string } {
  if (classfp === 'C7') return { type: 'city', local: 'Independent city' };
  if (/ Parish$/.test(name)) return { type: 'parish', local: 'Parish' };
  if (/ Borough$/.test(name)) return { type: 'borough', local: 'Borough' };
  if (/ Census Area$/.test(name)) return { type: 'borough', local: 'Census Area' };
  if (/ Municipio$/.test(name)) return { type: 'municipality', local: 'Municipio' };
  return { type: 'county', local: 'County' };
}

/** national_county2020.txt: STATE|STATEFP|COUNTYFP|COUNTYNS|COUNTYNAME|CLASSFP|FUNCSTAT */
export function parseCounties(text: string, states: ReadonlySet<string>): EntityInput[] {
  return rows(text).flatMap(([, st, co, , name, classfp]) => {
    if (!st || !co || !name || !states.has(st)) return [];
    const { type, local } = countyType(name, classfp ?? '');
    return [division('US', `${st}${co}`, { parent: `div:US:${st}`, name, level: 2, type, typeLocal: local, extra: { state_fips: st, class_code: classfp ?? null, code_system: 'FIPS 6-4' } })];
  });
}

export const US: NationalSource = {
  country: 'US',
  meta: {
    id: 'nat-us',
    authority: 'U.S. Census Bureau (Geographic Reference: ANSI/FIPS codes, 2020)',
    url: 'https://www.census.gov/library/reference/code-lists/ansi.html',
    license: 'U.S. federal government work (17 U.S.C. § 105: no copyright in the United States); Census Bureau open data policy page read, explicit public-domain wording not located',
    version: 'codes2020',
    attribution: 'Source: U.S. Census Bureau, ANSI/FIPS geographic reference codes (2020).',
  },
  licenseStatus: 'partial',
  levels: ['state', 'county'],
  async load(cacheDir) {
    const states = parseStates(await fetchText(`${BASE}/national_state2020.txt`, 'us_state2020.txt', cacheDir));
    const fips = new Set(states.map((s) => s.code!));
    return [...states, ...parseCounties(await fetchText(`${BASE}/national_county2020.txt`, 'us_county2020.txt', cacheDir), fips)];
  },
};
