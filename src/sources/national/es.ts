import type { EntityInput } from '../../model.js';
import { fetchBytes, fetchText } from '../fetch.js';
import { readXlsx } from '../xlsx.js';
import { division, type NationalSource } from './types.js';

const DICT = (yy: string) => `https://www.ine.es/daco/daco42/codmun/diccionario${yy}.xlsx`;
const TEMPUS = 'https://servicios.ine.es/wstempus/js/ES/VALORES_VARIABLE';

export interface TempusValue { Id: number; Nombre: string; Codigo: string; FK_JerarquiaPadres?: number[] }

/**
 * INE: comunidad autónoma (variable 70) > provincia (variable 115) > municipio (diccionarioYY.xlsx).
 * Names of the two upper levels come from INE's Tempus API; municipalities (code = CPRO+CMUN, 5 digits)
 * from the yearly municipality dictionary. Province -> community follows the Tempus hierarchy ids.
 */
export function mapIne(ccaaValues: TempusValue[], provValues: TempusValue[], dict: string[][]): EntityInput[] {
  const out: EntityInput[] = [];
  const ccaaById = new Map<number, string>();
  for (const v of ccaaValues) {
    if (!/^(0[1-9]|1\d)$/.test(v.Codigo)) continue;
    ccaaById.set(v.Id, v.Codigo);
    out.push(division('ES', `ca-${v.Codigo}`, { parent: 'country:ES', name: v.Nombre, level: 1, type: 'region', typeLocal: 'comunidad autónoma', extra: { ine: v.Codigo } }));
  }
  const provs = new Set<string>();
  for (const v of provValues) {
    if (!/^\d\d$/.test(v.Codigo) || v.Codigo === '00') continue;
    const ca = (v.FK_JerarquiaPadres ?? []).map((i) => ccaaById.get(i)).find(Boolean);
    if (!ca) throw new Error(`INE: province ${v.Codigo} has no community parent — Tempus layout changed`);
    provs.add(v.Codigo);
    out.push(division('ES', `prov-${v.Codigo}`, { parent: `div:ES:ca-${ca}`, name: v.Nombre, level: 2, type: 'province', typeLocal: 'provincia', extra: { ine: v.Codigo } }));
  }
  const hdr = dict.findIndex((r) => r[0] === 'CODAUTO' && r[1] === 'CPRO' && r[2] === 'CMUN' && r[4] === 'NOMBRE');
  if (hdr < 0) throw new Error('INE dictionary: header CODAUTO/CPRO/CMUN/DC/NOMBRE not found — layout changed');
  const seen = new Set<string>();
  for (const r of dict.slice(hdr + 1)) {
    const [, cpro, cmun, dc, nombre] = r;
    if (!cpro || !cmun || !nombre || !/^\d\d$/.test(cpro) || !/^\d{3}$/.test(cmun)) continue;
    if (!provs.has(cpro)) throw new Error(`INE dictionary: unknown province ${cpro}`);
    const code = cpro + cmun;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(division('ES', `mun-${code}`, { parent: `div:ES:prov-${cpro}`, name: nombre, level: 3, type: 'municipality', typeLocal: 'municipio', extra: { ine: code, check_digit: dc ?? null } }));
  }
  if (seen.size < 8000) throw new Error(`INE: only ${seen.size} municipalities — layout changed`);
  return out;
}

export const ES: NationalSource = {
  country: 'ES',
  meta: {
    id: 'nat-es',
    authority: 'Instituto Nacional de Estadística (INE) – municipality dictionary and INEbase Tempus API',
    url: 'https://www.ine.es/daco/daco42/codmun/codmunmapa.htm',
    license: 'INE "Reutilización de la información" (read 2026-10-05, docs/licenses/nat-es.md): commercial or non-commercial reuse of information whose original source is INE itself; conditions: do not distort, cite the source ("Fuente: Sitio web del INE: www.ine.es" / "Elaboración propia con datos extraídos del sitio web del INE: www.ine.es"), mention last update date, do not suggest INE endorsement. Partial: no sub-licence wording.',
    version: 'INE (latest)',
    attribution: 'Elaboración propia con datos extraídos del sitio web del INE: www.ine.es',
  },
  licenseStatus: 'partial',
  levels: ['comunidad autónoma', 'provincia', 'municipio'],
  async load(cacheDir) {
    let dict: Uint8Array | null = null;
    let version = '';
    const y = new Date().getUTCFullYear() % 100;
    for (const yy of [y, y - 1, y - 2].map((n) => String(n).padStart(2, '0'))) {
      try {
        dict = await fetchBytes(DICT(yy), `es_diccionario${yy}.xlsx`, cacheDir);
        version = `INE 1 January 20${yy}`;
        break;
      } catch {
        /* not published (yet) — try the previous year */
      }
    }
    if (!dict) throw new Error('INE: no municipality dictionary found for the last three years');
    const rows = readXlsx(dict)[0]?.rows ?? [];
    this.meta.version = version;
    const ccaa = JSON.parse(await fetchText(`${TEMPUS}/70`, 'es_tempus_70.json', cacheDir)) as TempusValue[];
    const prov = JSON.parse(await fetchText(`${TEMPUS}/115`, 'es_tempus_115.json', cacheDir)) as TempusValue[];
    return mapIne(ccaa, prov, rows);
  },
};
