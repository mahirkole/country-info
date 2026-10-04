import type { EntityInput } from '../../model.js';
import { fetchBytes } from '../fetch.js';
import { parseCsvRows } from '../csv.js';
import { division, type NationalSource } from './types.js';

const URL = 'https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv';

/**
 * ISTAT "Elenco dei comuni italiani" (semicolon CSV, Windows-1252): one row per comune.
 * Columns used: 0 region code, 10 region name, 1 UTS (province / metropolitan city / ...) code,
 * 11 UTS name, 12 UTS type code, 14 vehicle sigla, 4 comune code, 5 name (Italian and foreign),
 * 6 Italian name, 7 other-language name, 23-25 NUTS 2024.
 */
export function parseIstat(text: string): EntityInput[] {
  const rows = parseCsvRows(text, ';').slice(1).filter((r) => r.length > 12 && r[4]);
  const out: EntityInput[] = [];
  const seen = new Set<string>();
  const add = (e: EntityInput) => {
    if (!seen.has(e.id)) (seen.add(e.id), out.push(e));
  };
  const t = (r: string[], i: number) => (r[i] ?? '').trim();
  for (const r of rows) {
    const reg = t(r, 0);
    const uts = t(r, 1);
    add(division('IT', `reg-${reg}`, { parent: 'country:IT', name: t(r, 10), level: 1, type: 'region', typeLocal: 'regione', extra: { istat: reg, nuts2: t(r, 24) || null } }));
    add(division('IT', `uts-${uts}`, {
      parent: `div:IT:reg-${reg}`, name: t(r, 11), level: 2, type: 'province', typeLocal: 'unità territoriale sovracomunale',
      extra: { istat: uts, uts_type_code: t(r, 12) || null, sigla: t(r, 14) || null, nuts3: t(r, 25) || null },
    }));
    add(division('IT', `com-${t(r, 4)}`, {
      parent: `div:IT:uts-${uts}`, name: t(r, 5), level: 3, type: 'municipality', typeLocal: 'comune',
      extra: { istat: t(r, 4), name_it: t(r, 6) || null, name_other: t(r, 7) || null, capoluogo: t(r, 13) === '1', cadastral_code: t(r, 19) || null },
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
    license: 'ISTAT Note legali (read): "Salvo diversa indicazione, tutti i contenuti pubblicati su questo sito sono soggetti alla licenza Creative Commons – Attribuzione – versione 4.0"',
    version: 'Elenco-comuni-italiani.csv (current)',
    attribution: 'Fonte: Istat, Elenco dei comuni italiani (CC BY 4.0).',
  },
  licenseStatus: 'read',
  levels: ['region', 'province (UTS)', 'municipality'],
  async load(cacheDir) {
    const bytes = await fetchBytes(URL, 'it_comuni.csv', cacheDir);
    return parseIstat(new TextDecoder('windows-1252').decode(bytes));
  },
};
