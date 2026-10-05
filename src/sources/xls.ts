import * as CFB from 'cfb';
import type { Sheet } from './xlsx.js';

/**
 * Minimal reader for legacy Excel 97–2003 workbooks (BIFF8 in an OLE2 container): cell values only (shared strings,
 * numbers, RK numbers), no formulas or styles. Enough for official code lists still published as .xls.
 */
const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
const f64 = (b: Uint8Array, o: number) => new DataView(b.buffer, b.byteOffset + o, 8).getFloat64(0, true);

function rk(v: number): number {
  const mul = v & 1 ? 0.01 : 1;
  if (v & 2) return (v >> 2) * mul;
  const buf = new DataView(new ArrayBuffer(8));
  buf.setUint32(4, (v & 0xfffffffc) >>> 0, true);
  return buf.getFloat64(0, true) * mul;
}

interface Rec { type: number; data: Uint8Array }

function* records(b: Uint8Array, start: number): Generator<Rec & { pos: number }> {
  let o = start;
  while (o + 4 <= b.length) {
    const type = u16(b, o);
    const len = u16(b, o + 2);
    yield { type, data: b.subarray(o + 4, o + 4 + len), pos: o };
    o += 4 + len;
  }
}

/** Shared string table; strings may continue in CONTINUE records, each continuation restarting with its own flags byte. */
function parseSst(chunks: Uint8Array[]): string[] {
  const out: string[] = [];
  let ci = 0;
  let o = 8; // skip total + unique counts in the first chunk
  const unique = u32(chunks[0]!, 4);
  const cur = () => chunks[ci]!;
  const take = (n: number): Uint8Array => {
    const res = new Uint8Array(n);
    let got = 0;
    while (got < n) {
      if (o >= cur().length) { ci++; o = 0; }
      const k = Math.min(n - got, cur().length - o);
      res.set(cur().subarray(o, o + k), got);
      got += k;
      o += k;
    }
    return res;
  };
  while (out.length < unique && ci < chunks.length) {
    if (o >= cur().length) { ci++; o = 0; if (ci >= chunks.length) break; }
    const hdr = take(3);
    const cch = hdr[0]! | (hdr[1]! << 8);
    let flags = hdr[2]!;
    let runs = 0;
    let ext = 0;
    if (flags & 8) runs = u16(take(2), 0);
    if (flags & 4) ext = u32(take(4), 0);
    let s = '';
    let left = cch;
    while (left > 0) {
      if (o >= cur().length) { ci++; o = 0; flags = cur()[o++]!; }
      const wide = flags & 1;
      const avail = Math.floor((cur().length - o) / (wide ? 2 : 1));
      const n = Math.min(left, avail);
      const bytes = take(n * (wide ? 2 : 1));
      s += wide ? new TextDecoder('utf-16le').decode(bytes) : new TextDecoder('latin1').decode(bytes);
      left -= n;
    }
    if (runs) take(runs * 4);
    if (ext) take(ext);
    out.push(s);
  }
  return out;
}

export function readXls(bytes: Uint8Array): Sheet[] {
  const cfb = CFB.read(bytes, { type: 'buffer' });
  const entry = CFB.find(cfb, '/Workbook') ?? CFB.find(cfb, '/Book');
  if (!entry?.content) throw new Error('xls: no Workbook stream — not a BIFF8 workbook');
  const b = new Uint8Array(entry.content as ArrayLike<number>);
  const sheets: { name: string; offset: number }[] = [];
  const sstChunks: Uint8Array[] = [];
  let inSst = false;
  let depth = 0;
  for (const r of records(b, 0)) {
    if (r.type === 0x0809) depth++;
    else if (r.type === 0x000a) { depth--; if (depth <= 0) break; }
    else if (depth === 1 && r.type === 0x0085) {
      const cch = r.data[6]!;
      const wide = r.data[7]! & 1;
      sheets.push({ name: new TextDecoder(wide ? 'utf-16le' : 'latin1').decode(r.data.subarray(8, 8 + cch * (wide ? 2 : 1))), offset: u32(r.data, 0) });
    } else if (r.type === 0x00fc) { inSst = true; sstChunks.push(r.data); }
    else if (r.type === 0x003c && inSst) sstChunks.push(r.data);
    else inSst = false;
  }
  const sst = sstChunks.length ? parseSst(sstChunks) : [];
  return sheets.map(({ name, offset }) => {
    const grid: Map<number, Map<number, string>> = new Map();
    const put = (row: number, col: number, v: string) => {
      if (!grid.has(row)) grid.set(row, new Map());
      grid.get(row)!.set(col, v);
    };
    let d = 0;
    for (const r of records(b, offset)) {
      if (r.type === 0x0809) d++;
      else if (r.type === 0x000a) { d--; if (d <= 0) break; }
      else if (r.type === 0x00fd) put(u16(r.data, 0), u16(r.data, 2), sst[u32(r.data, 6)] ?? '');
      else if (r.type === 0x0203) put(u16(r.data, 0), u16(r.data, 2), String(f64(r.data, 6)));
      else if (r.type === 0x027e) put(u16(r.data, 0), u16(r.data, 2), String(rk(u32(r.data, 6))));
      else if (r.type === 0x00bd) {
        const row = u16(r.data, 0);
        const first = u16(r.data, 2);
        for (let i = 0, p = 4; p + 6 <= r.data.length - 2; i++, p += 6) put(row, first + i, String(rk(u32(r.data, p + 2))));
      } else if (r.type === 0x0204) {
        const n = u16(r.data, 6);
        put(u16(r.data, 0), u16(r.data, 2), new TextDecoder('latin1').decode(r.data.subarray(8, 8 + n)));
      }
    }
    const maxRow = Math.max(-1, ...grid.keys());
    const rows: string[][] = [];
    for (let i = 0; i <= maxRow; i++) {
      const cells = grid.get(i);
      if (!cells) { rows.push([]); continue; }
      const width = Math.max(...cells.keys()) + 1;
      rows.push(Array.from({ length: width }, (_, c) => cells.get(c) ?? ''));
    }
    return { name, rows };
  });
}
