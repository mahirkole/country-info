import { describe, expect, it } from 'vitest';
import * as CFB from 'cfb';
import { readXls } from '../src/sources/xls.js';
import { parseElstat, findRegisterLink } from '../src/sources/national/gr.js';

const rec = (type: number, data: number[]) => [type & 255, type >> 8, data.length & 255, data.length >> 8, ...data];
const u16 = (n: number) => [n & 255, (n >> 8) & 255];
const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const f64 = (n: number) => [...new Uint8Array(new Float64Array([n]).buffer)];
const latin = (s: string) => [...s].map((c) => c.charCodeAt(0));
const utf16 = (s: string) => [...s].flatMap((c) => u16(c.charCodeAt(0)));

/** Builds a one-sheet BIFF8 workbook: SST with a latin string, a UTF-16 string and a string split across CONTINUE records. */
function workbook(): Uint8Array {
  const bof = rec(0x0809, [...u16(0x600), ...u16(0x10), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const strings = [[...u16(3), 0, ...latin('Aba')], [...u16(2), 1, ...utf16('Δή')]];
  // third string "Hello World" (11 chars) split after "Hello": the continuation restarts with a flags byte
  const first = [...u32(3), ...u32(3), ...strings.flat(), ...u16(11), 0, ...latin('Hello')];
  const sst = [...rec(0x00fc, first), ...rec(0x003c, [0, ...latin(' World')])];
  const sheetName = 'S1';
  const boundsheetLen = 4 + 4 + 2 + 2 + sheetName.length; // record header + offset + visibility/type + cch/flags + name
  const wbPrefix = bof.length + boundsheetLen + sst.length + 4; // + EOF record
  const bound = rec(0x0085, [...u32(wbPrefix), 0, 0, sheetName.length, 0, ...latin(sheetName)]);
  const eof = rec(0x000a, []);
  const cells = [
    ...rec(0x00fd, [...u16(0), ...u16(0), ...u16(0), ...u32(0)]),
    ...rec(0x00fd, [...u16(0), ...u16(1), ...u16(0), ...u32(1)]),
    ...rec(0x00fd, [...u16(1), ...u16(0), ...u16(0), ...u32(2)]),
    ...rec(0x0203, [...u16(1), ...u16(2), ...u16(0), ...f64(12.5)]),
    ...rec(0x027e, [...u16(2), ...u16(0), ...u16(0), ...u32((42 << 2) | 2)]),
  ];
  const stream = new Uint8Array([...bof, ...bound, ...sst, ...eof, ...bof, ...cells, ...eof]);
  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, '/Workbook', stream as unknown as number[]);
  return new Uint8Array(CFB.write(cfb, { type: 'buffer' }) as ArrayLike<number>);
}

describe('xls reader', () => {
  it('reads shared strings (latin, UTF-16, split across CONTINUE), numbers and RK cells', () => {
    const [s] = readXls(workbook());
    expect(s!.name).toBe('S1');
    expect(s!.rows).toEqual([['Aba', 'Δή'], ['Hello World', '', '12.5'], ['42']]);
  });
});

describe('GR register', () => {
  const sh = (name: string, rows: string[][]) => ({ name, rows: [['title'], ['h'], ['Κωδικός'], ['', 'Κεφαλαία', 'Πεζά'], ...rows] });
  it('builds region > regional unit > municipality and rejects broken parents', () => {
    const regions = Array.from({ length: 13 }, (_, i) => [String(11 + i), 'X', `Περιφέρεια ${i} (Έδρα: Πόλη${i},η)`]);
    const units = Array.from({ length: 75 }, (_, i) => [String(i + 1).padStart(2, '0'), 'X', `Π.Ε. ${i}`, String(11 + (i % 13))]);
    const muni = Array.from({ length: 333 }, (_, i) => [`${String((i % 75) + 1).padStart(2, '0')}${String(Math.floor(i / 75) + 1).padStart(2, '0')}`, 'X', `Δήμος ${i}`, String((i % 75) + 1).padStart(2, '0')]);
    muni[332] = ['9901', 'X', 'Άγιο Όρος', '01'];
    const e = parseElstat([sh('Περιφέρειες (NUTS 2)', regions), sh('Περιφερειακές Ενότητες', units), sh('Δήμοι', muni)]);
    expect(e.find((x) => x.id === 'div:GR:reg-11')).toMatchObject({ name: 'Περιφέρεια 0', data: { seat: 'Πόλη0' } });
    expect(e.find((x) => x.id === 'div:GR:dim-9901')).toMatchObject({ data: { status: 'autonomous' } });
    expect(e.find((x) => x.id === 'div:GR:dim-0101')!.parent_id).toBe('div:GR:pe-01');
    muni[0] = ['0001', 'X', 'Bad', '88'];
    expect(() => parseElstat([sh('Περιφέρειες (NUTS 2)', regions), sh('Περιφερειακές Ενότητες', units), sh('Δήμοι', muni)])).toThrow(/unknown regional unit/);
    expect(findRegisterLink('<a href="https://www.statistics.gr:443/el/statistics?a=1&amp;documentID=583882&amp;b=2">x</a>')).toBe('https://www.statistics.gr/el/statistics?a=1&documentID=583882&b=2');
  });
});
