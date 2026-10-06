import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { division, type NationalSource } from './types.js';

const SERVICE = 'https://eservices.dls.moi.gov.cy/arcgis/rest/services/National/AdminBoundaries_Indexes_GR/MapServer';
const query = (layer: number) => `${SERVICE}/${layer}/query?where=1%3D1&outFields=*&returnGeometry=false&f=json`;

interface Feature { attributes?: Record<string, unknown> }

/**
 * Department of Lands and Surveys (DLS) administrative-boundary service: layer 10 = 6 districts (επαρχίες), layer 11 = the 613 municipality and
 * community areas (the layer does not say which are municipalities and which communities). Geometry is not requested. Names are Greek, upper case.
 * The units are those of the Republic of Cyprus, including the districts of Kyrenia and Famagusta.
 */
export function parseCyprus(districts: { features?: Feature[]; exceededTransferLimit?: boolean }, communities: { features?: Feature[]; exceededTransferLimit?: boolean }): EntityInput[] {
  const d = districts.features;
  const c = communities.features;
  if (!Array.isArray(d) || !Array.isArray(c) || districts.exceededTransferLimit || communities.exceededTransferLimit) throw new Error('DLS service: unexpected response (or transfer limit exceeded) — layout changed');
  const out: EntityInput[] = [];
  const dist = new Set<number>();
  for (const f of d) {
    const code = f.attributes?.DIST_CODE;
    const name = f.attributes?.DIST_NM_G;
    if (typeof code !== 'number' || typeof name !== 'string' || !name) throw new Error('DLS districts layer: unexpected feature — layout changed');
    dist.add(code);
    out.push(division('CY', `dist-${code}`, { parent: 'country:CY', name, level: 1, type: 'district', typeLocal: 'επαρχία', extra: { dls: code } }));
  }
  const seen = new Set<string>();
  for (const f of c) {
    const [dc, vc, name] = [f.attributes?.DIST_CODE, f.attributes?.VIL_CODE, f.attributes?.VIL_NM_G];
    if (typeof dc !== 'number' || typeof vc !== 'number' || typeof name !== 'string' || !name || !dist.has(dc)) throw new Error('DLS communities layer: unexpected feature — layout changed');
    const key = `${dc}-${vc}`;
    if (seen.has(key)) throw new Error(`DLS communities layer: duplicate code ${key}`);
    seen.add(key);
    out.push(division('CY', `vil-${key}`, { parent: `div:CY:dist-${dc}`, name, level: 2, type: 'municipality', typeLocal: 'δήμος/κοινότητα', extra: { dls_district: dc, dls_code: vc } }));
  }
  if (dist.size !== 6 || seen.size < 600 || seen.size > 625) throw new Error(`DLS service: ${dist.size} districts and ${seen.size} communities (expected 6 and about 613) — layout changed`);
  return out;
}

export const CY: NationalSource = {
  country: 'CY',
  meta: {
    id: 'nat-cy',
    authority: 'Τμήμα Κτηματολογίου και Χωρομετρίας (Department of Lands and Surveys, Cyprus) – administrative boundaries of municipalities and communities',
    url: 'https://www.data.gov.cy/el/dataset/dioikitika-oria-dimon-kai-koinotiton-dioikitikos-hartis',
    license: 'data.gov.cy dataset page (read 2026-10-06, docs/licenses/nat-cy.md): "Άδεια Χρήσης Creative Commons Attribution 4.0 International (CC BY 4.0)"; publisher: Τμήμα Κτηματολογίου και Χωρομετρίας.',
    attribution: 'Source: Department of Lands and Surveys, Republic of Cyprus (data.gov.cy), CC BY 4.0',
  },
  licenseStatus: 'read',
  levels: ['επαρχία', 'δήμος/κοινότητα'],
  async load(cacheDir) {
    const [d, c] = await Promise.all([fetchText(query(10), 'cy_dls_districts.json', cacheDir), fetchText(query(11), 'cy_dls_communities.json', cacheDir)]);
    return parseCyprus(JSON.parse(d), JSON.parse(c));
  },
};
