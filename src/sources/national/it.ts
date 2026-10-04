import type { EntityInput } from '../../model.js';
import { fetchBytes } from '../fetch.js';
import { readXlsx } from '../xlsx.js';
import { division, type NationalSource } from './types.js';

// The CSV at the same path is stale (last modified Jan 2024); the xlsx is the maintained file.
const URL = 'https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.xlsx';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Column positions by header text, so a re-ordered or extended ISTAT sheet keeps working. */
function columns(header: string[]) {
  const h = header.map(norm);
  const find = (re: RegExp) => h.findIndex((x) => re.test(x));
  const need = (name: string, re: RegExp) => {
    const i = find(re);
    if (i < 0) throw new Error(`ISTAT sheet has no column "${name}"`);
    return i;
  };
  const nutsYear = Math.max(0, ...h.map((x) => Number(/^codice nuts3 (\d{4})/.exec(x)?.[1] ?? 0)));
  return {
    reg: need('Codice Regione', /^codice regione$/),
    uts: need('Codice UTS', /^codice dell'unità territoriale sovracomunale/),
    comune: need('Codice Comune alfanumerico', /^codice comune formato alfanumerico$/),
    name: need('Denominazione (Italiana e straniera)', /^denominazione \(italiana e straniera\)$/),
    nameIt: find(/^denominazione in italiano$/),
    nameOther: find(/^denominazione altra lingua$/),
    regName: need('Denominazione Regione', /^denominazione regione$/),
    utsName: need('Denominazione UTS', /^denominazione dell'unità territoriale sovracomunale/),
    utsType: find(/^tipologia di unità territoriale sovracomunale/),
    capoluogo: find(/^flag comune capoluogo/),
    sigla: find(/^sigla automobilistica$/),
    cadastral: find(/^codice catastale del comune$/),
    nuts2: nutsYear ? find(new RegExp(`^codice nuts2 ${nutsYear}`)) : -1,
    nuts3: nutsYear ? find(new RegExp(`^codice nuts3 ${nutsYear}`)) : -1,
  };
}

/**
 * ISTAT "Elenco dei comuni italiani" rows (first row = header): one row per comune.
 * Builds region > UTS (province / metropolitan city / free consortium) > comune; each unit once.
 */
export function parseIstat(rows: string[][]): EntityInput[] {
  const [header, ...body] = rows;
  if (!header) return [];
  const c = columns(header);
  const out: EntityInput[] = [];
  const seen = new Set<string>();
  const add = (e: EntityInput) => {
    if (!seen.has(e.id)) (seen.add(e.id), out.push(e));
  };
  const t = (r: string[], i: number) => (i < 0 ? '' : (r[i] ?? '').trim());
  for (const r of body) {
    if (!t(r, c.comune)) continue;
    const reg = t(r, c.reg);
    const uts = t(r, c.uts);
    add(division('IT', `reg-${reg}`, { parent: 'country:IT', name: t(r, c.regName), level: 1, type: 'region', typeLocal: 'regione', extra: { istat: reg, nuts2: t(r, c.nuts2) || null } }));
    add(division('IT', `uts-${uts}`, {
      parent: `div:IT:reg-${reg}`, name: t(r, c.utsName), level: 2, type: 'province', typeLocal: 'unità territoriale sovracomunale',
      extra: { istat: uts, uts_type_code: t(r, c.utsType) || null, sigla: t(r, c.sigla) || null, nuts3: t(r, c.nuts3) || null },
    }));
    add(division('IT', `com-${t(r, c.comune)}`, {
      parent: `div:IT:uts-${uts}`, name: t(r, c.name), level: 3, type: 'municipality', typeLocal: 'comune',
      extra: { istat: t(r, c.comune), name_it: t(r, c.nameIt) || null, name_other: t(r, c.nameOther) || null, capoluogo: t(r, c.capoluogo) === '1', cadastral_code: t(r, c.cadastral) || null },
    }));
  }
  return out;
}

export const IT: NationalSource = {
  country: 'IT',
  meta: {
    id: 'nat-it',
    authority: 'ISTAT (Istituto nazionale di statistica) – Elenco dei comuni italiani',
    url: URL,
    license: 'ISTAT Note legali (read): "Salvo diversa indicazione, tutti i contenuti pubblicati su questo sito sono soggetti alla licenza Creative Commons – Attribuzione – versione 4.0"; the dataset page states no other terms (docs/licenses/nat-it.md)',
    version: 'ISTAT Elenco comuni (current)',
    attribution: 'Fonte: Istat, Elenco dei comuni italiani (CC BY 4.0).',
  },
  licenseStatus: 'read',
  levels: ['region', 'province (UTS)', 'municipality'],
  async load(cacheDir) {
    const sheet = readXlsx(await fetchBytes(URL, 'it_comuni.xlsx', cacheDir))[0];
    if (!sheet) throw new Error('ISTAT workbook has no sheets');
    this.meta.version = `ISTAT ${sheet.name}`; // e.g. "CODICI al 21_02_2026"
    return parseIstat(sheet.rows);
  },
};
