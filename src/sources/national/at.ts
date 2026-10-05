import { strFromU8, unzipSync } from 'fflate';
import type { EntityInput } from '../../model.js';
import { fetchBytes } from '../fetch.js';
import { parseCsvRows } from '../csv.js';
import { division, type NationalSource } from './types.js';

const URL = 'https://www.statistik.at/verzeichnis/reglisten/reglisten.zip';

const find = (rows: string[][], header: string) => {
  const i = rows.findIndex((r) => r[0] === header);
  if (i < 0) throw new Error(`STATISTIK AUSTRIA list has no "${header}" header row (layout changed)`);
  return rows.slice(i + 1).filter((r) => r.length > 2 && (r[0] ?? '').trim() !== ''); // footer lines ("Quelle: …") have a single cell
};

/**
 * `polbezirke.csv` (Bundesland, politischer Bezirk) and `gemliste_knz.csv` (Gemeinden). A Gemeinde's first three
 * digits are its Bezirk. Vienna is one Bezirk (900) whose 23 Gemeindebezirke (901–923) repeat that Bezirk code in
 * the list; they are modelled below the Gemeinde Wien (90001), keyed by their own code in the last column.
 * Postal-code columns are deliberately not read.
 */
export function parseAustria(polbezirke: string, gemliste: string): { entities: EntityInput[]; asOf: string | null } {
  const pb = find(parseCsvRows(polbezirke, ';'), 'Bundeslandkennziffer');
  const gm = find(parseCsvRows(gemliste, ';'), 'Gemeindekennziffer');
  const asOf = /Gebietsstand\s+(\d{4})/.exec(polbezirke)?.[1] ?? null;
  const out: EntityInput[] = [];
  const states = new Set<string>();
  const districts = new Set<string>();
  for (const r of pb) {
    const [land, landName, bez, bezName, own] = [r[0]!.trim(), (r[1] ?? '').trim(), (r[2] ?? '').trim(), (r[3] ?? '').trim(), (r[4] ?? '').trim() || (r[2] ?? '').trim()];
    if (own !== bez) {
      // Gemeindebezirk of Vienna: own code differs from the Bezirk code it is listed under
      out.push(division('AT', `bez-${own}`, { parent: `div:AT:gem-${bez}01`, name: bezName, level: 4, type: 'district', typeLocal: 'Gemeindebezirk', extra: { code: own } }));
      continue;
    }
    if (!states.has(land)) {
      states.add(land);
      out.push(division('AT', `land-${land}`, { parent: 'country:AT', name: landName, level: 1, type: 'state', typeLocal: 'Bundesland', extra: { code: land } }));
    }
    districts.add(bez);
    out.push(division('AT', `bez-${bez}`, { parent: `div:AT:land-${land}`, name: bezName, level: 2, type: 'district', typeLocal: 'politischer Bezirk', extra: { code: bez } }));
  }
  const STATUS: Record<string, string> = { SR: 'Statutarstadt', S: 'Stadtgemeinde', M: 'Marktgemeinde', G: 'Gemeinde' };
  const seen = new Set<string>();
  for (const r of gm) {
    const code = r[0]!.trim();
    if (seen.has(code)) continue; // the list repeats Wien (90001) once per Gemeindebezirk
    seen.add(code);
    const bez = code.slice(0, 3);
    const parent = districts.has(bez) ? `div:AT:bez-${bez}` : states.has(code[0]!) ? `div:AT:land-${code[0]}` : null;
    if (!parent) continue;
    const status = (r[3] ?? '').trim();
    out.push(division('AT', `gem-${code}`, { parent, name: (r[1] ?? '').trim(), level: 3, type: 'municipality', typeLocal: STATUS[status] ?? 'Gemeinde', extra: { code, status: status || null } }));
  }
  return { entities: out, asOf };
}

export const AT: NationalSource = {
  country: 'AT',
  meta: {
    id: 'nat-at',
    authority: 'STATISTIK AUSTRIA – Regionale Gliederungen (Gemeinde- und Bezirkslisten)',
    url: URL,
    license: 'STATISTIK AUSTRIA open.data: Creative Commons Namensnennung 4.0 (CC BY 4.0); for the reglisten files www.statistik.at AGB § 10: reproduction and distribution, also commercial, permitted with source "STATISTIK AUSTRIA", changed content must be marked as edited (docs/licenses/nat-at.md). Postal-code and street files are not used.',
    version: 'Regionale Gliederungen (current)',
    attribution: 'Quelle: STATISTIK AUSTRIA (CC BY 4.0), bearbeitet.',
  },
  licenseStatus: 'read',
  levels: ['Bundesland', 'politischer Bezirk', 'Gemeinde'],
  async load(cacheDir) {
    const files = unzipSync(await fetchBytes(URL, 'at_reglisten.zip', cacheDir), { filter: (f) => f.name === 'polbezirke.csv' || f.name === 'gemliste_knz.csv' });
    const pol = files['polbezirke.csv'];
    const gem = files['gemliste_knz.csv'];
    if (!pol || !gem) throw new Error('reglisten.zip lacks polbezirke.csv or gemliste_knz.csv');
    const { entities, asOf } = parseAustria(strFromU8(pol), strFromU8(gem));
    this.meta.version = `STATISTIK AUSTRIA Gebietsstand ${asOf ?? '?'}`;
    this.meta.attribution = `Quelle: STATISTIK AUSTRIA, Regionale Gliederungen, Gebietsstand ${asOf ?? '?'} (CC BY 4.0), bearbeitet.`;
    return entities;
  },
};
