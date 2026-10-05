import type { EntityInput } from '../../model.js';
import { fetchBytes, fetchText } from '../fetch.js';
import { readXlsx, type Sheet } from '../xlsx.js';
import { division, type NationalSource } from './types.js';

const PAGE = 'https://www.soumu.go.jp/denshijiti/code.html';

/** First .xlsx on the MIC page is "都道府県コード及び市区町村コード" (the following ones are the change list and association codes). */
export function findCodeFile(html: string): string {
  const m = /href="(\/main_content\/\d+\.xlsx)"/.exec(html);
  if (!m) throw new Error('MIC code list page: no .xlsx link found — layout changed');
  return `https://www.soumu.go.jp${m[1]}`;
}

/** Some designated-city ward names carry the kana reading appended ("熊本市南区クマモトシミナミク"). */
const clean = (n: string) => n.replace(/\r?\n/g, '').replace(/^(.+?[区])[ァ-ヴー]+$/, '$1').trim();

/**
 * MIC 全国地方公共団体コード: prefecture (都道府県) > municipality (市区町村); wards of designated cities (政令指定都市の区)
 * sit under their city. The 6-digit code is the official local-government code (5 digits + check digit); the first two are the prefecture.
 */
export function parseMic(sheets: Sheet[]): EntityInput[] {
  const main = sheets[0]?.rows ?? [];
  if (!main[0]?.[0]?.startsWith('団体コード') || !main[0]?.[1]?.includes('都道府県名')) throw new Error('MIC code list: header changed');
  const out: EntityInput[] = [];
  const prefs = new Set<string>();
  const cityByName = new Map<string, string>();
  const codes = new Set<string>();
  for (const r of main.slice(1)) {
    const code = r[0]?.trim();
    const pref = r[1]?.trim();
    const mun = r[2]?.trim();
    if (!code || !/^\d{6}$/.test(code) || !pref) continue;
    const pc = code.slice(0, 2);
    if (!mun) {
      prefs.add(pc);
      out.push(division('JP', `pref-${pc}`, { parent: 'country:JP', name: pref, level: 1, type: 'prefecture', typeLocal: '都道府県', extra: { lg_code: code, name_kana: r[3]?.trim() || null } }));
      continue;
    }
    codes.add(code);
    cityByName.set(`${pc}|${mun}`, code);
    if (!prefs.has(pc)) throw new Error(`MIC code list: municipality ${code} before its prefecture`);
    out.push(division('JP', `mun-${code}`, { parent: `div:JP:pref-${pc}`, name: mun, level: 2, type: 'municipality', typeLocal: '市区町村', extra: { lg_code: code, prefecture: pref, name_kana: r[4]?.trim() || null } }));
  }
  for (const r of sheets[1]?.rows.slice(1) ?? []) {
    const code = r[0]?.trim();
    const name = clean(r[2] ?? '');
    if (!code || !/^\d{6}$/.test(code) || !name || codes.has(code)) continue;
    const city = /^(.+?市)/.exec(name)?.[1];
    const parent = city ? cityByName.get(`${code.slice(0, 2)}|${city}`) : undefined;
    if (!parent) continue;
    codes.add(code);
    out.push(division('JP', `mun-${code}`, { parent: `div:JP:mun-${parent}`, name, level: 3, type: 'ward', typeLocal: '区', extra: { lg_code: code, prefecture: r[1]?.trim() ?? null, name_kana: r[4]?.trim() || null } }));
  }
  if (prefs.size !== 47 || codes.size < 1700) throw new Error(`MIC code list: ${prefs.size} prefectures / ${codes.size} municipalities — layout changed`);
  return out;
}

export const JP: NationalSource = {
  country: 'JP',
  meta: {
    id: 'nat-jp',
    authority: 'Ministry of Internal Affairs and Communications (総務省) – 全国地方公共団体コード',
    url: PAGE,
    license: 'MIC site copyright notice (read 2026-10-05, docs/licenses/nat-jp.md): content is usable under 公共データ利用規約 (Public Data Terms v1.0, CC BY-compatible); credit the source (出典：総務省ホームページ + URL), state when edited/processed, never present processed data as made by the state. Partial: the terms text itself and its explicit commercial-use wording were not read; no per-file notice on the code list page.',
    version: 'MIC (latest)',
    attribution: '出典：総務省ホームページ「全国地方公共団体コード」(https://www.soumu.go.jp/denshijiti/code.html) を加工して作成',
  },
  licenseStatus: 'partial',
  levels: ['都道府県 (prefecture)', '市区町村 (municipality)', '区 (ward of designated city)'],
  async load(cacheDir) {
    const url = findCodeFile(await fetchText(PAGE, 'jp_code_page.html', cacheDir));
    const sheets = readXlsx(await fetchBytes(url, 'jp_codes.xlsx', cacheDir));
    this.meta.version = `MIC ${sheets[0]?.name ?? 'latest'}`;
    return parseMic(sheets);
  },
};
