import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SourceMeta } from '../model.js';
import { type HolidayFile } from './rules.js';

export const HOLIDAYS_SOURCE: SourceMeta = {
  id: 'official-holidays',
  authority: 'National legislation and official announcements (see per-record source)',
  license: 'Facts; citations per record',
};

export async function loadHolidayFiles(dir = join(process.cwd(), 'data', 'holidays')): Promise<HolidayFile[]> {
  const files = (await readdir(dir)).filter((f) => /^[A-Z]{2}\.json$/.test(f)).sort();
  const out: HolidayFile[] = [];
  for (const f of files) {
    const parsed = JSON.parse(await readFile(join(dir, f), 'utf8')) as HolidayFile;
    if (parsed.country !== f.slice(0, 2)) throw new Error(`${f}: country field is ${parsed.country}`);
    out.push(parsed);
  }
  return out;
}
