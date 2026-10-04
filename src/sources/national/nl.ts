import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { division, type NationalSource } from './types.js';

const TABLE = '86247NED'; // CBS "Gebieden in Nederland 2026"
const URL = `https://opendata.cbs.nl/ODataApi/odata/${TABLE}/TypedDataSet?$select=Code_1,Naam_2,Code_26,Naam_27,Code_28,Naam_29&$format=json`;

interface Row { Code_1: string; Naam_2: string; Code_26: string; Naam_27: string; Code_28: string; Naam_29: string }
const t = (s: string | undefined) => (s ?? '').trim();

/** CBS pads codes and names with spaces. Landsdeel (LDxx) > provincie (PVxx) > gemeente (GMxxxx). */
export function parseCbs(rows: Row[]): EntityInput[] {
  const out: EntityInput[] = [];
  const seen = new Set<string>();
  const add = (e: EntityInput) => {
    if (!seen.has(e.id)) (seen.add(e.id), out.push(e));
  };
  for (const r of rows) {
    const ld = t(r.Code_26);
    const pv = t(r.Code_28);
    const gm = t(r.Code_1);
    if (!gm.startsWith('GM')) continue;
    if (ld.startsWith('LD')) add(division('NL', ld, { parent: 'country:NL', name: t(r.Naam_27), level: 1, type: 'region', typeLocal: 'landsdeel', extra: { cbs: ld } }));
    if (pv.startsWith('PV')) add(division('NL', pv, { parent: ld.startsWith('LD') ? `div:NL:${ld}` : 'country:NL', name: t(r.Naam_29), level: 2, type: 'province', typeLocal: 'provincie', extra: { cbs: pv } }));
    add(division('NL', gm, { parent: pv.startsWith('PV') ? `div:NL:${pv}` : 'country:NL', name: t(r.Naam_2), level: 3, type: 'municipality', typeLocal: 'gemeente', extra: { cbs: gm } }));
  }
  return out;
}

export const NL: NationalSource = {
  country: 'NL',
  meta: {
    id: 'nat-nl',
    authority: 'CBS (Centraal Bureau voor de Statistiek) – Gebieden in Nederland 2026 (86247NED)',
    url: URL,
    license: 'CBS website copyright page (read): "Unless otherwise stated, the content of this website is subject to Creative Commons Attribution (CC BY 4.0)… provided Statistics Netherlands is cited as the source". The page covers website content; the StatLine OData table itself carries no separate licence text that was located.',
    version: `Gebieden in Nederland 2026 (${TABLE})`,
    attribution: 'Bron: CBS, Gebieden in Nederland 2026 (CC BY 4.0).',
  },
  licenseStatus: 'partial',
  levels: ['landsdeel', 'provincie', 'gemeente'],
  async load(cacheDir) {
    const body = JSON.parse(await fetchText(URL, 'nl_gebieden.json', cacheDir, undefined, { accept: 'application/json' })) as { value: Row[] };
    return parseCbs(body.value);
  },
};
