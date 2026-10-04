import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { division, type NationalSource } from './types.js';

const API = 'https://geo.api.gouv.fr';

interface Region { code: string; nom: string }
interface Departement { code: string; nom: string; codeRegion?: string }
interface Commune { code: string; nom: string; codeDepartement?: string; codeRegion?: string; population?: number }

/** Regions -> departments -> communes (INSEE Code officiel géographique via geo.api.gouv.fr). */
export function mapFrance(regions: Region[], departements: Departement[], communes: Commune[]): EntityInput[] {
  const out: EntityInput[] = [];
  const regionIds = new Set(regions.map((r) => r.code));
  for (const r of regions) out.push(division('FR', `reg-${r.code}`, { parent: 'country:FR', name: r.nom, level: 1, type: 'region', typeLocal: 'région', extra: { insee: r.code } }));
  const deptIds = new Set<string>();
  for (const d of departements) {
    deptIds.add(d.code);
    out.push(division('FR', `dep-${d.code}`, {
      parent: d.codeRegion && regionIds.has(d.codeRegion) ? `div:FR:reg-${d.codeRegion}` : 'country:FR',
      name: d.nom, level: 2, type: 'department', typeLocal: 'département', extra: { insee: d.code },
    }));
  }
  for (const c of communes) {
    // Overseas collectivities (e.g. 975, 98x) are not in /departements: attach them to the country.
    const parent = c.codeDepartement && deptIds.has(c.codeDepartement) ? `div:FR:dep-${c.codeDepartement}` : 'country:FR';
    out.push(division('FR', `com-${c.code}`, { parent, name: c.nom, level: 3, type: 'municipality', typeLocal: 'commune', extra: { insee: c.code, population: c.population ?? null } }));
  }
  return out;
}

/** geo.api.gouv.fr resets connections now and then through some proxies; retry a few times. */
async function getJson<T>(path: string, name: string, cacheDir: string): Promise<T> {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      return JSON.parse(await fetchText(`${API}/${path}`, name, cacheDir)) as T;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}

export const FR: NationalSource = {
  country: 'FR',
  meta: {
    id: 'nat-fr',
    authority: 'INSEE (Code officiel géographique) via geo.api.gouv.fr (DINUM / Etalab)',
    url: 'https://geo.api.gouv.fr/decoupage-administratif',
    license: 'geo.api.gouv.fr (api.gouv.fr page read): "Toutes les données utilisées sont sous licences Open Data"; INSEE COG licence text not located. The API also lists OpenStreetMap as a partner (geometries); only INSEE names, codes and populations are used.',
    version: 'geo.api.gouv.fr current',
    attribution: 'Source: INSEE, Code officiel géographique, via geo.api.gouv.fr (DINUM).',
  },
  licenseStatus: 'partial',
  levels: ['region', 'department', 'commune'],
  async load(cacheDir) {
    const regions = await getJson<Region[]>('regions', 'fr_regions.json', cacheDir);
    const deps = await getJson<Departement[]>('departements?fields=nom,code,codeRegion', 'fr_departements.json', cacheDir);
    const coms = await getJson<Commune[]>('communes?fields=nom,code,codeDepartement,codeRegion,population', 'fr_communes.json', cacheDir);
    return mapFrance(regions, deps, coms);
  },
};
