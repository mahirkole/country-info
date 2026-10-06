import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { division, type NationalSource } from './types.js';

const SEARCH = 'https://data-osi.opendata.arcgis.com/api/search/v1/collections/all/items?q=National%20Statutory%20Boundaries%20Local%20Authorities%20Ungeneralised&limit=50';

interface Hit { properties?: { title?: string; url?: string } }
interface Feature { attributes?: { BDY_ID?: number; BDY_TYPE_VALUE?: string; ENG_NAME_VALUE?: string; GLE_NAME_VALUE?: string } }

/** The newest "Local Authorities … Ungeneralised <year>" feature service of Tailte Éireann (a new service per vintage: 2019, 2024, 2026 …). */
export function latestLocalAuthorityService(search: unknown): { url: string; year: number } {
  const hits = ((search as { features?: Hit[] }).features ?? []).map((f) => f.properties).filter((p): p is { title: string; url: string } => !!p?.title && !!p.url);
  const cands = hits.flatMap((p) => {
    const m = /^Local Authorities\b.*Ungeneralised\D*(\d{4})\s*$/i.exec(p.title.replace(/\s+/g, ' ').trim());
    return m && /\/FeatureServer\/?$/.test(p.url) ? [{ url: p.url.replace(/\/$/, ''), year: Number(m[1]) }] : [];
  });
  if (!cands.length) throw new Error('Tailte Éireann hub search: no "Local Authorities … Ungeneralised" feature service — layout changed');
  return cands.sort((a, b) => b.year - a.year)[0]!;
}

/**
 * Tailte Éireann (OSi) National Statutory Boundaries – Local Authorities: the 31 local authorities (26 county councils incl. the Dublin ones, plus city councils),
 * identified by the official `BDY_ID`. The layer is multipart polygons, so it is queried with `returnDistinctValues=true` (attributes only, no geometry).
 */
export function parseIreland(json: unknown): EntityInput[] {
  const features = (json as { features?: Feature[]; exceededTransferLimit?: boolean }).features;
  if (!Array.isArray(features) || (json as { exceededTransferLimit?: boolean }).exceededTransferLimit) throw new Error('Tailte Éireann local authorities layer: unexpected response — layout changed');
  const out: EntityInput[] = [];
  const seen = new Set<number>();
  for (const f of features) {
    const a = f.attributes;
    if (!a || typeof a.BDY_ID !== 'number' || !a.ENG_NAME_VALUE || !a.BDY_TYPE_VALUE) throw new Error('Tailte Éireann local authorities layer: unexpected feature — layout changed');
    if (seen.has(a.BDY_ID)) throw new Error(`Tailte Éireann local authorities layer: duplicate BDY_ID ${a.BDY_ID}`);
    seen.add(a.BDY_ID);
    const city = /^City Council$/i.test(a.BDY_TYPE_VALUE);
    out.push(division('IE', `la-${a.BDY_ID}`, { parent: 'country:IE', name: a.ENG_NAME_VALUE, level: 1, type: city ? 'city' : 'county', typeLocal: a.BDY_TYPE_VALUE, extra: { osi_bdy_id: a.BDY_ID, ...(a.GLE_NAME_VALUE ? { name_ga: a.GLE_NAME_VALUE } : {}) } }));
  }
  if (out.length < 28 || out.length > 34) throw new Error(`Tailte Éireann local authorities layer: ${out.length} units (the publisher states 31) — layout changed`);
  return out;
}

export const IE: NationalSource = {
  country: 'IE',
  meta: {
    id: 'nat-ie',
    authority: 'Tailte Éireann (Ordnance Survey Ireland) – National Statutory Boundaries, Local Authorities',
    url: 'https://data-osi.opendata.arcgis.com/',
    license: 'Tailte Éireann item description (read 2026-10-06, docs/licenses/nat-ie.md): "Tailte Éireann content published as open data is licenced under a Creative Commons Attribution 4.0 International (CC BY 4.0) licence"; the item states "The country is currently divided into 31 local authorities." Credit: © Tailte Éireann.',
    attribution: 'Contains data © Tailte Éireann, licensed under CC BY 4.0',
  },
  licenseStatus: 'read',
  levels: ['local authority'],
  async load(cacheDir) {
    const svc = latestLocalAuthorityService(JSON.parse(await fetchText(SEARCH, 'ie_osi_hub_search.json', cacheDir)));
    const layers = JSON.parse(await fetchText(`${svc.url}?f=json`, `ie_osi_la_${svc.year}_service.json`, cacheDir)) as { layers?: { id: number }[] };
    const layer = layers.layers?.[0]?.id;
    if (layer === undefined) throw new Error('Tailte Éireann local authorities service has no layer — layout changed');
    const q = `${svc.url}/${layer}/query?where=1%3D1&outFields=BDY_ID,BDY_TYPE_VALUE,ENG_NAME_VALUE,GLE_NAME_VALUE&returnGeometry=false&returnDistinctValues=true&orderByFields=BDY_ID&f=json`;
    return parseIreland(JSON.parse(await fetchText(q, `ie_osi_la_${svc.year}.json`, cacheDir)));
  },
};
