import type { EntityInput } from '../../model.js';
import { fetchBytes, fetchText } from '../fetch.js';
import { readXlsx, type Sheet } from '../xlsx.js';
import { division, type NationalSource } from './types.js';

const PAGE = 'https://www.ksh.hu/apps/hntr.egyeb?p_lang=HU&p_sablon=LETOLTES';
const FILE = (year: string) => `https://www.ksh.hu/docs/helysegnevtar/hnt_letoltes_${year}.xlsx`;
// KSH's firewall answers a plain client with a 200 "Request Rejected" stub; a browser-like request gets the file.
const BROWSER = {
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  accept: '*/*',
  referer: 'https://www.ksh.hu/',
};

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Newest Helységnévtár workbook linked from the KSH download page. */
export function findHntFile(html: string): string {
  const years = [...html.matchAll(/hnt_letoltes_(\d{4})\.xlsx/g)].map((m) => m[1]!).sort();
  if (!years.length) throw new Error('KSH Helységnévtár page: no hnt_letoltes_<year>.xlsx link — layout changed');
  return FILE(years[years.length - 1]!);
}

const STATUS: Record<string, { type: string; local: string }> = {
  'megyeszékhely, megyei jogú város': { type: 'city', local: 'megyeszékhely, megyei jogú város' },
  'megyei jogú város': { type: 'city', local: 'megyei jogú város' },
  város: { type: 'city', local: 'város' },
  nagyközség: { type: 'municipality', local: 'nagyközség' },
  község: { type: 'municipality', local: 'község' },
};

/**
 * KSH Helységnévtár (sheet "Helységek <date>"): vármegye (county; Budapest stands alone) > settlement, with Budapest's 23
 * districts under the capital. Counties have no code in the file, so their ids come from the official names.
 */
export function parseHnt(sheets: Sheet[]): EntityInput[] {
  const sheet = sheets.find((s) => s.name.startsWith('Helységek'));
  const hdr = sheet?.rows.findIndex((r) => r[0] === 'Helység megnevezése' && r[1] === 'Helység KSH kódja' && r[2] === 'Helység jogállása' && r[3] === 'Vármegye megnevezése');
  if (!sheet || hdr === undefined || hdr < 0) throw new Error('KSH Helységnévtár: header not found — layout changed');
  const out: EntityInput[] = [];
  const counties = new Set<string>();
  let capital: string | null = null;
  let settlements = 0;
  const rows = sheet.rows.slice(hdr + 1).filter((r) => r[0]?.trim() && /^\d{5}$/.test((r[1] ?? '').trim()));
  for (const r of rows) {
    const name = r[0]!.trim();
    const code = r[1]!.trim();
    const status = (r[2] ?? '').trim();
    const county = (r[3] ?? '').trim();
    if (status === 'főváros') {
      capital = `div:HU:${code}`;
      out.push(division('HU', code, { parent: 'country:HU', name, level: 1, type: 'city', typeLocal: 'főváros', extra: { ksh: code } }));
    } else if (status === 'fővárosi kerület') {
      if (!capital) throw new Error('KSH Helységnévtár: district before the capital row');
      out.push(division('HU', code, { parent: capital, name, level: 2, type: 'borough', typeLocal: 'fővárosi kerület', extra: { ksh: code } }));
    } else {
      const t = STATUS[status];
      if (!t || !county) throw new Error(`KSH Helységnévtár: unknown status "${status}" or county for ${name}`);
      if (!counties.has(county)) {
        counties.add(county);
        out.push(division('HU', `vm-${slug(county)}`, { parent: 'country:HU', name: county, level: 1, type: 'county', typeLocal: 'vármegye' }));
      }
      settlements++;
      out.push(division('HU', code, { parent: `div:HU:vm-${slug(county)}`, name, level: 2, type: t.type, typeLocal: t.local, extra: { ksh: code, jaras_code: (r[4] ?? '').replace(/\s/g, '') || null, jaras: r[5]?.trim() || null } }));
    }
  }
  if (counties.size !== 19 || settlements < 3100 || settlements > 3200 || !capital) throw new Error(`KSH Helységnévtár: ${counties.size} counties / ${settlements} settlements — layout changed`);
  return out;
}

export const HU: NationalSource = {
  country: 'HU',
  meta: {
    id: 'nat-hu',
    authority: 'Központi Statisztikai Hivatal (KSH) – Helységnévtár',
    url: PAGE,
    license: 'KSH copyright page (read 2026-10-05, docs/licenses/nat-hu.md): content is under CC BY 4.0 ("A KSH a Creative Commons Attribution 4.0 International (CC BY 4.0)… licencet használja… a Honlapon található összes tartalom… szabadon másolhatók, sokszorosíthatók és terjeszthetők"), source "Forrás: KSH". Exception for custom extracts from internal databases (not this standard download).',
    version: 'KSH Helységnévtár (latest)',
    attribution: 'Forrás: KSH (www.ksh.hu), Helységnévtár. CC BY 4.0',
  },
  licenseStatus: 'read',
  levels: ['vármegye', 'település', 'fővárosi kerület'],
  async load(cacheDir) {
    const url = findHntFile(await fetchText(PAGE, 'hu_hnt_page.html', cacheDir, undefined, BROWSER));
    const sheets = readXlsx(await fetchBytes(url, 'hu_helysegnevtar.xlsx', cacheDir, undefined, BROWSER));
    this.meta.version = `KSH Helységnévtár ${sheets.find((s) => s.name.startsWith('Helységek'))?.name.replace('Helységek ', '') ?? ''}`.trim();
    return parseHnt(sheets);
  },
};
