import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { parseCsv } from '../csv.js';
import { division, type NationalSource } from './types.js';

const API = 'https://ogcapi.dgterritorio.gov.pt/collections';

type Props = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const km2 = (v: unknown) => (v !== '' && v != null && Number.isFinite(Number(v)) ? Math.round(Number(v)) / 100 : null);

/**
 * DGT CAOP (Carta Administrativa Oficial de Portugal), mainland only: distrito > município > freguesia.
 * Codes are the official DICO digits: distrito `01`, município `0101`, freguesia `010103`.
 * The OGC API exposes only Continente; Açores and Madeira are published as geopackages (not read here).
 */
export function mapCaop(distritos: Props[], municipios: Props[], freguesias: Props[]): EntityInput[] {
  const out: EntityInput[] = [];
  const dts = new Set<string>();
  for (const r of distritos) {
    const code = s(r.dt);
    const name = s(r.distrito);
    if (!code || !name || !/^\d\d$/.test(code)) continue;
    dts.add(code);
    out.push(division('PT', `dt-${code}`, { parent: 'country:PT', name, level: 1, type: 'district', typeLocal: 'distrito', extra: { dico: code } }));
  }
  const mns = new Set<string>();
  for (const r of municipios) {
    const code = s(r.dtmn);
    const name = s(r.municipio);
    if (!code || !name || !/^\d{4}$/.test(code) || !dts.has(code.slice(0, 2))) continue;
    mns.add(code);
    out.push(division('PT', `mn-${code}`, { parent: `div:PT:dt-${code.slice(0, 2)}`, name, level: 2, type: 'municipality', typeLocal: 'município', extra: { dico: code, nuts3_code: s(r.nuts3_cod), nuts3: s(r.nuts3), nuts2: s(r.nuts2), area_km2: km2(r.area_ha) } }));
  }
  for (const r of freguesias) {
    const code = s(r.dtmnfr);
    const name = s(r.freguesia);
    if (!code || !name || !/^\d{4}[0-9A-Z]{2}$/.test(code) || !mns.has(code.slice(0, 4))) continue;
    out.push(division('PT', `fr-${code}`, { parent: `div:PT:mn-${code.slice(0, 4)}`, name, level: 3, type: 'parish', typeLocal: 'freguesia', extra: { dico: code, short_name: s(r.designacao_simplificada), area_km2: km2(r.area_ha) } }));
  }
  if (dts.size < 15 || mns.size < 250 || out.length - dts.size - mns.size < 2500) throw new Error(`CAOP: ${dts.size} distritos / ${mns.size} municípios — layout changed`);
  return out;
}

async function items(collection: string, cacheDir: string): Promise<Props[]> {
  const out: Props[] = [];
  for (let offset = 0; ; offset += 1000) {
    // CSV rather than GeoJSON: the JSON envelope carries a timestamp that would defeat the raw-input hash.
    const url = `${API}/${collection}/items?f=csv&limit=1000&offset=${offset}&skipGeometry=true`;
    const rows = parseCsv(await fetchText(url, `pt_${collection}_${offset}.csv`, cacheDir, undefined, { accept: 'text/csv' }));
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export const PT: NationalSource = {
  country: 'PT',
  meta: {
    id: 'nat-pt',
    authority: 'Direção-Geral do Território (DGT) – Carta Administrativa Oficial de Portugal (CAOP), OGC API',
    url: 'https://ogcapi.dgterritorio.gov.pt/',
    license: 'CC BY 4.0 (read 2026-10-05, docs/licenses/nat-pt.md): DGT open-data page states geographic information downloaded from its data centre is under CC-BY 4.0, free use with the sole obligation to credit DGT as owner; dados.gov.pt records the CAOP datasets as cc-by. Partial: the page names the data centre and lists the OGC API alongside; Açores and Madeira are not covered (only Continente is served).',
    version: 'CAOP (latest)',
    attribution: 'Fonte: Direção-Geral do Território (DGT), Carta Administrativa Oficial de Portugal (CAOP). CC BY 4.0',
  },
  licenseStatus: 'partial',
  levels: ['distrito', 'município', 'freguesia'],
  async load(cacheDir) {
    const meta = JSON.parse(await fetchText(`${API}/municipios?f=json`, 'pt_municipios_meta.json', cacheDir, undefined, { accept: 'application/json' })) as { title?: string };
    this.meta.version = meta.title?.match(/CAOP\d{4}/)?.[0] ?? 'CAOP';
    return mapCaop(await items('distritos', cacheDir), await items('municipios', cacheDir), await items('freguesias', cacheDir));
  },
};
