import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { parseCsv } from '../csv.js';
import { division, type NationalSource } from './types.js';

/** Federal Statistical Office's official municipality register (REST, no key): snapshot of the state on a date. */
const snapshotUrl = (year: number) => `https://www.agvchapp.bfs.admin.ch/api/communes/snapshot?date=01-01-${year}`;

/**
 * Level 1 = canton, 2 = district (Bezirk), 3 = municipality; `Parent` is the parent's HistoricalCode.
 * Municipalities of cantons without districts point at the canton directly.
 */
export function parseBfs(rows: Record<string, string>[]): EntityInput[] {
  const byHist = new Map<string, string>(); // HistoricalCode -> entity id
  const idOf = (r: Record<string, string>) => (r['Level'] === '3' ? `gem-${r['BfsCode']}` : r['Level'] === '2' ? `bez-${r['HistoricalCode']}` : `kt-${r['HistoricalCode']}`);
  for (const r of rows) if (r['HistoricalCode'] && ['1', '2', '3'].includes(r['Level'] ?? '')) byHist.set(r['HistoricalCode'], `div:CH:${idOf(r)}`);
  const out: EntityInput[] = [];
  for (const r of rows) {
    const level = r['Level'];
    if (!['1', '2', '3'].includes(level ?? '') || !r['HistoricalCode']) continue;
    const parent = level === '1' ? 'country:CH' : byHist.get(r['Parent'] ?? '');
    if (!parent) continue;
    const t = level === '1' ? { type: 'canton', local: 'Kanton' } : level === '2' ? { type: 'district', local: 'Bezirk' } : { type: 'municipality', local: 'Gemeinde' };
    out.push(division('CH', idOf(r).replace(/^/, ''), { parent, name: r['Name'] || r['ShortName'] || '', level: Number(level), type: t.type, typeLocal: t.local, extra: { historical_code: r['HistoricalCode'], bfs_code: r['BfsCode'] || null, short_name: r['ShortName'] || null, valid_from: r['ValidFrom'] || null } }));
  }
  return out;
}

export const CH: NationalSource = {
  country: 'CH',
  meta: {
    id: 'nat-ch',
    authority: 'Bundesamt für Statistik (BFS) – Amtliches Gemeindeverzeichnis der Schweiz',
    url: snapshotUrl(new Date().getUTCFullYear()),
    license: 'opendata.swiss terms "Open use" (terms_open, read on the dataset record and https://opendata.swiss/en/terms-of-use): "You may use this dataset for commercial purposes. You are recommended to provide the source." No sentence covers redistribution/resale explicitly and BFS\'s own terms page was unreachable (docs/licenses/nat-ch.md).',
    version: 'BFS Gemeindeverzeichnis (current)',
    attribution: 'Quelle: Bundesamt für Statistik (BFS), Amtliches Gemeindeverzeichnis der Schweiz.',
  },
  licenseStatus: 'partial',
  levels: ['Kanton', 'Bezirk', 'Gemeinde'],
  async load(cacheDir) {
    const year = new Date().getUTCFullYear();
    this.meta.version = `BFS Gemeindeverzeichnis Stand 01.01.${year}`;
    this.meta.url = snapshotUrl(year);
    return parseBfs(parseCsv(await fetchText(snapshotUrl(year), `ch_snapshot_${year}.csv`, cacheDir)));
  },
};
