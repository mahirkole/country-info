import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { parseCsvRows } from '../csv.js';
import { division, type NationalSource } from './types.js';

const PAGE = 'https://www.dst.dk/en/Statistik/dokumentation/nomenklaturer/nuts';

/** The classification download link on the Danmarks Statistik page (`.../klassifikationsbilag/<guid>csv_en`); the GUID changes with revisions, so it is resolved at every refresh. */
export function findDkCsvUrl(html: string): string {
  const m = /https:\/\/www\.dst\.dk\/klassifikationsbilag\/[0-9a-f-]+csv_en/.exec(html);
  if (!m) throw new Error('DST NUTS page: no classification CSV link — layout changed');
  return m[0];
}

/**
 * DST classification "Regions, provinces and municipalities" (NUTS_V1_2007_DK): CSV `SEQUENCE;CODE;LEVEL;TITLE;…`. There is no parent column; the
 * parent is the nearest preceding row of the level above. Level 1 = region (5), level 2 = province/landsdel (11), level 3 = municipality (kommune,
 * 98 plus the state-administered Christiansø which the classification lists at the same level).
 */
export function parseDenmark(csv: string): EntityInput[] {
  const rows = parseCsvRows(csv.replace(/^﻿/, ''), ';');
  const header = rows[0] ?? [];
  const col = (n: string) => header.indexOf(n);
  const [iCode, iLevel, iTitle] = [col('CODE'), col('LEVEL'), col('TITLE')];
  if (iCode < 0 || iLevel < 0 || iTitle < 0) throw new Error('DST classification CSV: CODE/LEVEL/TITLE columns missing — layout changed');
  const out: EntityInput[] = [];
  const last: Record<number, string> = {};
  const seen = new Set<string>();
  for (const r of rows.slice(1)) {
    const code = (r[iCode] ?? '').trim();
    const level = Number(r[iLevel]);
    const name = (r[iTitle] ?? '').trim();
    if (!code) continue;
    if (!/^\d{2,3}$/.test(code) || ![1, 2, 3].includes(level) || !name) throw new Error(`DST classification CSV: unexpected row "${r.join(';').slice(0, 80)}" — layout changed`);
    if (seen.has(`${level}:${code}`)) throw new Error(`DST classification CSV: duplicate code ${code}`);
    seen.add(`${level}:${code}`);
    if (level > 1 && !last[level - 1]) throw new Error(`DST classification CSV: row ${code} has no parent — layout changed`);
    const id = level === 1 ? `reg-${code}` : level === 2 ? `lds-${code}` : `kom-${code}`;
    // level 2 hangs under its region, municipalities under their province
    const parentId = level === 1 ? 'country:DK' : level === 2 ? `div:DK:reg-${last[1]}` : `div:DK:lds-${last[2]}`;
    last[level] = code;
    out.push(division('DK', id, { parent: parentId, name, level, type: level === 1 ? 'region' : level === 2 ? 'province' : 'municipality', typeLocal: level === 1 ? 'region' : level === 2 ? 'landsdel' : 'kommune', extra: { dst: code } }));
  }
  const count = (l: number) => out.filter((e) => e.data.level === l).length;
  if (count(1) !== 5 || count(2) < 8 || count(2) > 14 || count(3) < 95 || count(3) > 105) throw new Error(`DST classification: ${count(1)} regions, ${count(2)} provinces, ${count(3)} municipalities (expected 5 / 11 / about 99) — layout changed`);
  return out;
}

export const DK: NationalSource = {
  country: 'DK',
  meta: {
    id: 'nat-dk',
    authority: 'Danmarks Statistik – classification of regions, provinces and municipalities (NUTS_V1_2007_DK)',
    url: PAGE,
    license: 'Danmarks Statistik source-attribution page (read 2026-10-06, docs/licenses/nat-dk.md): "Du må frit gengive Danmarks Statistiks indhold fra dst.dk og statistikbanken.dk. Det gælder også ved kommerciel brug. Men husk at angive os som kilde." The DST logo may not be used.',
    attribution: 'Source: Danmarks Statistik (dst.dk)',
  },
  licenseStatus: 'read',
  levels: ['region', 'landsdel', 'kommune'],
  async load(cacheDir) {
    const url = findDkCsvUrl(await fetchText(PAGE, 'dk_dst_nuts_page.html', cacheDir));
    return parseDenmark(await fetchText(url, 'dk_dst_nuts.csv', cacheDir));
  },
};
