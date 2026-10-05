import type { EntityInput } from '../../model.js';
import { fetchBytes, USER_AGENT } from '../fetch.js';
import { readXls } from '../xls.js';
import type { Sheet } from '../xlsx.js';
import { division, type NationalSource } from './types.js';

const PAGE = (year: number) => `https://www.statistics.gr/el/statistics/-/publication/SKA01/${year}`;

/** The workbook link on an ELSTAT publication page (the URL carries portlet ids, so it is scraped, not built). */
export function findRegisterLink(html: string): string | null {
  const m = /href="([^"]*documentID=\d+[^"]*)"/.exec(html);
  return m ? m[1]!.replace(/&amp;/g, '&').replace(':443', '') : null;
}

const seat = (s: string) => /^(.*?)\s*\(Έδρα:\s*(.*?)\)\s*$/.exec(s);

/**
 * ELSTAT "Μητρώο Οικισμών" (administrative division of Greece): περιφέρεια (13) > περιφερειακή ενότητα (75, incl. Mount Athos) >
 * δήμος (333, incl. the autonomous Mount Athos). Data rows start after the 4 header rows of each sheet.
 */
export function parseElstat(sheets: Sheet[]): EntityInput[] {
  const sheet = (re: RegExp) => {
    const s = sheets.find((x) => re.test(x.name.trim()));
    if (!s) throw new Error(`ELSTAT register: sheet ${re} not found — layout changed`);
    return s.rows.filter((r) => /^\d+$/.test((r[0] ?? '').trim()));
  };
  const out: EntityInput[] = [];
  const regions = new Set<string>();
  for (const r of sheet(/^Περιφέρειες \(NUTS 2\)$/)) {
    const code = r[0]!.trim();
    const s = seat(r[2] ?? '');
    regions.add(code);
    out.push(division('GR', `reg-${code}`, { parent: 'country:GR', name: (s ? s[1]! : r[2] ?? '').trim(), level: 1, type: 'region', typeLocal: 'περιφέρεια', extra: { elstat: code, seat: s?.[2]?.replace(/,(η|ο|το)$/, '') ?? null } }));
  }
  const units = new Set<string>();
  for (const r of sheet(/^Περιφερειακές Ενότητες$/)) {
    const code = r[0]!.trim();
    const parent = (r[3] ?? '').trim();
    if (!regions.has(parent)) throw new Error(`ELSTAT register: regional unit ${code} has unknown region ${parent}`);
    units.add(code);
    out.push(division('GR', `pe-${code}`, { parent: `div:GR:reg-${parent}`, name: (r[2] ?? '').trim(), level: 2, type: 'district', typeLocal: 'περιφερειακή ενότητα', extra: { elstat: code } }));
  }
  let municipalities = 0;
  for (const r of sheet(/^Δήμοι$/)) {
    const code = r[0]!.trim();
    const parent = (r[3] ?? '').trim();
    if (!units.has(parent)) throw new Error(`ELSTAT register: municipality ${code} has unknown regional unit ${parent}`);
    municipalities++;
    out.push(division('GR', `dim-${code}`, { parent: `div:GR:pe-${parent}`, name: (r[2] ?? '').trim(), level: 3, type: 'municipality', typeLocal: 'δήμος', extra: { elstat: code, ...(code === '9901' ? { status: 'autonomous' } : {}) } }));
  }
  if (regions.size !== 13 || units.size < 70 || units.size > 80 || municipalities < 330 || municipalities > 336) throw new Error(`ELSTAT register: ${regions.size} regions / ${units.size} regional units / ${municipalities} municipalities — layout changed`);
  return out;
}

export const GR: NationalSource = {
  country: 'GR',
  meta: {
    id: 'nat-gr',
    authority: 'Ελληνική Στατιστική Αρχή (ΕΛΣΤΑΤ) – Μητρώο Οικισμών (administrative division register)',
    url: PAGE(new Date().getUTCFullYear()),
    license: 'ELSTAT copyright and re-use policy (read 2026-10-05, docs/licenses/nat-gr.md): re-use "τόσο για μη εμπορικούς όσο και για εμπορικούς σκοπούς… χωρίς καμία πληρωμή ή γραπτή άδεια" provided the source is cited and any modification is stated; ELSTAT logo and third-party material excluded. Custom policy, not a Creative Commons licence.',
    version: 'ELSTAT register (latest)',
    attribution: 'Πηγή: ΕΛΣΤΑΤ (Ελληνική Στατιστική Αρχή), Μητρώο Οικισμών',
  },
  licenseStatus: 'read',
  levels: ['περιφέρεια', 'περιφερειακή ενότητα', 'δήμος'],
  async load(cacheDir) {
    const year = new Date().getUTCFullYear();
    let link: string | null = null;
    for (const y of [year, year - 1]) {
      // The page is not part of the raw-input hash (it carries per-request tokens); the workbook itself is.
      const res = await fetch(PAGE(y), { headers: { 'user-agent': USER_AGENT } });
      link = res.ok ? findRegisterLink(await res.text()) : null;
      if (link) break;
    }
    if (!link) throw new Error('ELSTAT: no register download link on the SKA01 publication pages — layout changed');
    const sheets = readXls(await fetchBytes(link, 'gr_elstat_register.xls', cacheDir));
    this.meta.version = `ELSTAT register ${sheets.find((s) => /^Δήμοι$/.test(s.name.trim())) ? `(${sheets[0]?.rows[0]?.[0]?.match(/\d\d\/\d\d\/\d{4}/)?.[0] ?? 'latest'})` : ''}`.trim();
    return parseElstat(sheets);
  },
};
