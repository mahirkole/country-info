import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { division, type NationalSource } from './types.js';

const API = 'https://ws.geonorge.no/kommuneinfo/v1';

interface Fylke { fylkesnummer: string; fylkesnavn: string }
interface FylkeDetail extends Fylke { kommuner: { kommunenummer: string; kommunenavn: string }[] }

/** fylke (county) > kommune (municipality), from Kartverket's administrative divisions API. */
export function mapNorway(fylker: FylkeDetail[]): EntityInput[] {
  const out: EntityInput[] = [];
  for (const f of fylker) {
    out.push(division('NO', `fylke-${f.fylkesnummer}`, { parent: 'country:NO', name: f.fylkesnavn, level: 1, type: 'county', typeLocal: 'fylke', extra: { nr: f.fylkesnummer } }));
    for (const k of f.kommuner) {
      out.push(division('NO', `kommune-${k.kommunenummer}`, { parent: `div:NO:fylke-${f.fylkesnummer}`, name: k.kommunenavn, level: 2, type: 'municipality', typeLocal: 'kommune', extra: { nr: k.kommunenummer } }));
    }
  }
  return out;
}

export const NO: NationalSource = {
  country: 'NO',
  meta: {
    id: 'nat-no',
    authority: 'Kartverket (Norwegian Mapping Authority) – Administrative inndelinger REST-API (Geonorge)',
    url: `${API}/`,
    license: 'Geonorge catalogue record (read): access constraints "Åpne data", "No conditions apply to access and use"; the record links no licence text (use constraints: "Lisens"). Geometries (avgrensningsboks) are not stored.',
    version: 'kommuneinfo v1 (current)',
    attribution: 'Source: Kartverket, Administrative inndelinger (Geonorge).',
  },
  licenseStatus: 'partial',
  levels: ['county (fylke)', 'municipality (kommune)'],
  async load(cacheDir) {
    const list = JSON.parse(await fetchText(`${API}/fylker`, 'no_fylker.json', cacheDir)) as Fylke[];
    const detail: FylkeDetail[] = [];
    for (const f of list) detail.push(JSON.parse(await fetchText(`${API}/fylker/${f.fylkesnummer}`, `no_fylke_${f.fylkesnummer}.json`, cacheDir)) as FylkeDetail);
    return mapNorway(detail);
  },
};
