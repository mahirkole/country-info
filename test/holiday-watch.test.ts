import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/api.js';
import { migrate } from '../src/db.js';
import { ackHolidayLaw, checkHolidayLaw, lawUrls, normalizeLawText } from '../src/holidays/watch.js';

const rule = (id: string, url: string | undefined, verification: string, extra: object = {}) => ({ id, names: { en: id }, type: 'public', when: { fixed: { month: 1, day: 1 } }, source: { citation: `Law ${id}`, ...(url ? { url } : {}), checked_on: '2026-10-05', ...extra }, verification });

const url = process.env.TEST_DATABASE_URL;
describe('law watch helpers', () => {
  it('normalizes markup, scripts and whitespace', () => {
    expect(normalizeLawText('<html><script>var x=1</script><p>§ 1  New&nbsp;Year\n is   a holiday</p><!-- c --></html>')).toBe('§ 1 New Year is a holiday');
  });
  it('collects URLs of verified, non-feed rules only', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hol-'));
    await writeFile(join(dir, 'DE.json'), JSON.stringify({ country: 'DE', authority: 'x', default_language: 'de', rules: [rule('a', 'https://law.test/a', 'verified'), rule('b', 'https://law.test/b', 'unverified'), rule('c', undefined, 'verified'), rule('d', 'https://feed.test/', 'verified', { feed: 'diyanet' })] }));
    await writeFile(join(dir, 'FR.json'), JSON.stringify({ country: 'FR', authority: 'x', default_language: 'fr', rules: [rule('e', 'https://law.test/a', 'verified')] }));
    expect(await lawUrls(dir)).toEqual([{ url: 'https://law.test/a', citations: ['Law a', 'Law e'], countries: ['DE', 'FR'] }]);
  });
});

describe.skipIf(!url)('law watch state machine', () => {
  const pool = new pg.Pool({ connectionString: url });
  let dir: string;
  const pages = new Map<string, string | Error>();
  const get = async (u: string) => { const v = pages.get(u); if (v instanceof Error) throw v; return v ?? ''; };
  beforeAll(() => migrate(pool));
  afterAll(() => pool.end());
  beforeEach(async () => {
    await pool.query('TRUNCATE holiday_law_watch');
    dir = await mkdtemp(join(tmpdir(), 'hol-'));
    await writeFile(join(dir, 'DE.json'), JSON.stringify({ country: 'DE', authority: 'x', default_language: 'de', rules: [rule('a', 'https://law.test/a', 'verified')] }));
    pages.clear();
    pages.set('https://law.test/a', '<p>§ 1 January 1st is a public holiday.</p>');
  });
  const run = async () => (await checkHolidayLaw(pool, '/tmp/none', { dir, get }))[0]!;

  it('baseline, unchanged, a one-off difference is pending, the same change twice is confirmed, ack adopts it', async () => {
    expect((await run()).status).toBe('baseline');
    expect((await run()).status).toBe('unchanged');
    pages.set('https://law.test/a', '<p>§ 1 January 1st and 2nd are public holidays.</p>');
    expect((await run()).status).toBe('pending');
    expect((await run()).status).toBe('changed');
    expect((await run()).status).toBe('open'); // alert stays until acknowledged
    expect(await ackHolidayLaw(pool, '/tmp/none', 'all', { get })).toEqual(['https://law.test/a']);
    expect((await run()).status).toBe('unchanged');
  });
  it('a transient difference that goes away raises nothing; a page that differs on every fetch is volatile', async () => {
    await run();
    pages.set('https://law.test/a', 'glitch');
    expect((await run()).status).toBe('pending');
    pages.set('https://law.test/a', '<p>§ 1 January 1st is a public holiday.</p>');
    expect((await run()).status).toBe('unchanged');
    for (let i = 1; i <= 3; i++) {
      pages.set('https://law.test/a', `visitors ${i}`);
      const r = await run();
      expect(r.status).toBe(i < 3 ? 'pending' : 'volatile');
    }
    expect((await pool.query('SELECT status FROM holiday_law_watch')).rows[0].status).toBe('volatile');
  });
  it('unreachable or empty pages are errors, not changes', async () => {
    await run();
    pages.set('https://law.test/a', new Error('403'));
    expect(await run()).toMatchObject({ status: 'error', detail: '403' });
    pages.set('https://law.test/a', '<script></script>');
    expect((await run()).status).toBe('error');
    expect((await pool.query('SELECT status, last_error FROM holiday_law_watch')).rows[0]).toMatchObject({ status: 'ok', last_error: 'empty page text' });
  });
  it('three consecutive fetch failures show up in /v1/status; one success clears them', async () => {
    await run();
    pages.set('https://law.test/a', new Error('503'));
    for (let i = 0; i < 3; i++) await run();
    const app = await buildApp(pool, { adminToken: 't', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    expect((await app.inject('/v1/status')).json().attention).toEqual(expect.arrayContaining([{ id: 'official-holidays', status: 'law_unreachable', urls: ['https://law.test/a'] }]));
    pages.set('https://law.test/a', '<p>§ 1 January 1st is a public holiday.</p>');
    await run();
    expect((await app.inject('/v1/status')).json().attention.some((a: { status: string }) => a.status === 'law_unreachable')).toBe(false);
    await app.close();
  });
  it('a confirmed change shows in /v1/status', async () => {
    await run();
    pages.set('https://law.test/a', 'new text');
    await run();
    await run();
    const app = await buildApp(pool, { adminToken: 't', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    const st = (await app.inject('/v1/status')).json();
    expect(st.ok).toBe(false);
    expect(st.attention).toEqual(expect.arrayContaining([{ id: 'official-holidays', status: 'law_changed', urls: ['https://law.test/a'] }]));
    await app.close();
  });
});
