import { strFromU8, unzipSync } from 'fflate';

export interface Sheet { name: string; rows: string[][] }

const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');

/** "AB12" -> column index 27 (0-based). */
export function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const text = (xml: string) => decode([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

/**
 * Minimal .xlsx reader: values only (shared strings, inline strings, numbers), no formulas or styles.
 * Enough for official code lists; dates come back as their serial numbers.
 */
export function readXlsx(bytes: Uint8Array): Sheet[] {
  const files = unzipSync(bytes);
  const get = (p: string) => (files[p] ? strFromU8(files[p]!) : '');
  const shared = [...get('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => text(m[1]!));
  const rels = new Map([...get('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)>/g)].map((m) => {
    const a = m[1]!;
    return [/Id="([^"]+)"/.exec(a)?.[1] ?? '', /Target="([^"]+)"/.exec(a)?.[1] ?? ''] as const;
  }));
  const sheets: Sheet[] = [];
  for (const m of get('xl/workbook.xml').matchAll(/<sheet\b([^>]*)>/g)) {
    const attrs = m[1]!;
    const name = decode(/name="([^"]*)"/.exec(attrs)?.[1] ?? '');
    const target = rels.get(/r:id="([^"]+)"/.exec(attrs)?.[1] ?? '') ?? '';
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    const xml = get(path);
    const rows: string[][] = [];
    for (const rm of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const row: string[] = [];
      for (const cm of (rm[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = cm[1]!;
        const ref = /r="([A-Z]+\d+)"/.exec(a)?.[1];
        const type = /t="([^"]+)"/.exec(a)?.[1];
        const inner = cm[2] ?? '';
        let v = '';
        if (type === 's') v = shared[Number(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? -1)] ?? '';
        else if (type === 'inlineStr') v = text(inner);
        else v = decode(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '');
        if (ref) row[columnIndex(ref)] = v;
      }
      rows.push(Array.from(row, (c) => c ?? ''));
    }
    sheets.push({ name, rows });
  }
  return sheets;
}
