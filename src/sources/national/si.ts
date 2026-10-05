import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { division, type NationalSource } from './types.js';

const TABLE = 'https://pxweb.stat.si/SiStatData/api/v1/en/Data/2640010S.px';

interface PxVariable { code: string; text: string; values: string[]; valueTexts: string[] }

/**
 * SURS PxWeb table "Selected data on municipalities": the MUNICIPALITIES variable lists code '0' (SLOVENIA) and the
 * municipalities '001'..'213'. Names of bilingual municipalities keep both forms ("Koper/Capodistria"). There is no
 * parent region attribute in the table, so municipalities hang directly under the country.
 */
export function mapSurs(variables: PxVariable[]): EntityInput[] {
  const v = variables.find((x) => x.code === 'OBČINE');
  if (!v) throw new Error('SURS table: variable OBČINE not found — layout changed');
  const out: EntityInput[] = [];
  v.values.forEach((code, i) => {
    if (!/^\d{3}$/.test(code)) return;
    out.push(division('SI', code, { parent: 'country:SI', name: v.valueTexts[i]!, level: 1, type: 'municipality', typeLocal: 'občina', extra: { surs: code } }));
  });
  if (out.length < 205 || out.length > 220) throw new Error(`SURS: ${out.length} municipalities, official count is 212 — layout changed`);
  return out;
}

export const SI: NationalSource = {
  country: 'SI',
  meta: {
    id: 'nat-si',
    authority: 'Statistični urad Republike Slovenije (SURS) – SiStat PxWeb, municipalities table',
    url: 'https://pxweb.stat.si/SiStatData/pxweb/en/Data/-/2640010S.px',
    license: 'SURS copyright page (read 2026-10-05, docs/licenses/nat-si.md): statistical data and information "may be used free of charge: to reproduce, distribute… in their original or modified form, to adapt, modify, and create derivative works… for any purpose, including for-profit (commercial)… without any restrictions on condition that… the Statistical Office of the Republic of Slovenia (or SURS) is acknowledged as their source."',
    version: 'SURS 2640010S',
    attribution: 'Source: Statistical Office of the Republic of Slovenia (SURS)',
  },
  licenseStatus: 'read',
  levels: ['občina'],
  async load(cacheDir) {
    const meta = JSON.parse(await fetchText(TABLE, 'si_surs_2640010S.json', cacheDir)) as { variables: PxVariable[] };
    return mapSurs(meta.variables);
  },
};
