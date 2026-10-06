import { createHash } from 'node:crypto';
import type pg from 'pg';
import { fetchText } from '../sources/fetch.js';
import { loadHolidayFiles } from './load.js';

/**
 * Watch of the legal texts cited by `verified` holiday rules. The rule files are the only hand-kept part of the holiday data
 * (CLAUDE.md "Otomasyon kuralı"); when a statute changes, the rules must be re-read. The text of each cited page is fingerprinted at every
 * run; a *confirmed* change (the same new fingerprint twice in a row) opens an alert until `ackHolidayLaw`. Pages that differ on every fetch are
 * reported as `volatile` instead of raising the alarm.
 */
export interface LawUrl { url: string; citations: string[]; countries: string[] }

/** Distinct source URLs of verified, non-feed rules with the citations and countries that rely on them. */
export async function lawUrls(dir?: string): Promise<LawUrl[]> {
  const map = new Map<string, { citations: Set<string>; countries: Set<string> }>();
  for (const f of await loadHolidayFiles(dir)) {
    for (const r of f.rules) {
      const src = r.source as { url?: string; citation?: string; feed?: string } | undefined;
      if (r.verification !== 'verified' || !src?.url || src.feed) continue;
      const e = map.get(src.url) ?? { citations: new Set<string>(), countries: new Set<string>() };
      if (src.citation) e.citations.add(src.citation);
      e.countries.add(f.country);
      map.set(src.url, e);
    }
  }
  return [...map].map(([url, e]) => ({ url, citations: [...e.citations].sort(), countries: [...e.countries].sort() })).sort((a, b) => a.url.localeCompare(b.url));
}

/** Page text without markup, scripts and whitespace differences. */
export function normalizeLawText(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export const lawFingerprint = (raw: string): string => createHash('sha256').update(normalizeLawText(raw)).digest('hex');

export type LawStatus = 'baseline' | 'unchanged' | 'pending' | 'changed' | 'open' | 'volatile' | 'error';
export interface LawCheck { url: string; status: LawStatus; detail?: string }
type Get = (url: string, name: string) => Promise<string>;

const nameOf = (url: string) => `law_${createHash('md5').update(url).digest('hex').slice(0, 12)}.txt`;

export async function checkHolidayLaw(pool: pg.Pool, cacheDir: string, o: { dir?: string; get?: Get } = {}): Promise<LawCheck[]> {
  const get: Get = o.get ?? ((url, name) => fetchText(url, name, cacheDir, 0));
  const out: LawCheck[] = [];
  for (const u of await lawUrls(o.dir)) {
    let fp: string;
    try {
      const text = normalizeLawText(await get(u.url, nameOf(u.url)));
      if (text === '') throw new Error('empty page text');
      fp = createHash('sha256').update(text).digest('hex');
    } catch (e) {
      await pool.query(`UPDATE holiday_law_watch SET last_error = $2, error_count = error_count + 1, checked_at = now() WHERE url = $1`, [u.url, (e as Error).message]);
      out.push({ url: u.url, status: 'error', detail: (e as Error).message });
      continue;
    }
    const row = (await pool.query('SELECT sha256, pending_sha256, flaps, status FROM holiday_law_watch WHERE url = $1', [u.url])).rows[0];
    if (!row) {
      await pool.query('INSERT INTO holiday_law_watch (url, sha256, citations, countries) VALUES ($1, $2, $3, $4)', [u.url, fp, u.citations, u.countries]);
      out.push({ url: u.url, status: 'baseline' });
      continue;
    }
    await pool.query('UPDATE holiday_law_watch SET citations = $2, countries = $3, last_error = NULL, error_count = 0, checked_at = now() WHERE url = $1', [u.url, u.citations, u.countries]);
    if (fp === row.sha256) {
      await pool.query('UPDATE holiday_law_watch SET pending_sha256 = NULL, flaps = 0, status = CASE WHEN status = \'volatile\' THEN \'ok\' ELSE status END WHERE url = $1', [u.url]);
      out.push({ url: u.url, status: row.status === 'changed' ? 'open' : 'unchanged' });
    } else if (row.status === 'changed') {
      out.push({ url: u.url, status: 'open' }); // already alerting; nothing new until acknowledged
    } else if (row.pending_sha256 === fp) {
      await pool.query(`UPDATE holiday_law_watch SET status = 'changed', changed_at = coalesce(changed_at, now()), flaps = 0 WHERE url = $1`, [u.url]);
      out.push({ url: u.url, status: 'changed', detail: `text of ${u.url} changed (cited by ${u.countries.join(', ')}); re-read the rules, then holiday-law-ack` });
    } else {
      const flaps = row.flaps + 1;
      await pool.query(`UPDATE holiday_law_watch SET pending_sha256 = $2, flaps = $3, status = CASE WHEN $3 >= 3 AND status = 'ok' THEN 'volatile' ELSE status END WHERE url = $1`, [u.url, fp, flaps]);
      out.push({ url: u.url, status: flaps >= 3 ? 'volatile' : 'pending', detail: flaps >= 3 ? 'text differs on every fetch (dynamic page); not alarming' : 'differs once; confirmed by the next run' });
    }
  }
  return out;
}

/** A person re-read the changed text and the rules: adopt the current text as the new baseline (one URL or `all`). */
export async function ackHolidayLaw(pool: pg.Pool, cacheDir: string, which: string, o: { get?: Get } = {}): Promise<string[]> {
  const get: Get = o.get ?? ((url, name) => fetchText(url, name, cacheDir, 0));
  const rows = (await pool.query(`SELECT url FROM holiday_law_watch WHERE status <> 'ok' AND ($1 = 'all' OR url = $1)`, [which])).rows as { url: string }[];
  const done: string[] = [];
  for (const { url } of rows) {
    await pool.query(`UPDATE holiday_law_watch SET sha256 = $2, pending_sha256 = NULL, flaps = 0, status = 'ok', changed_at = NULL WHERE url = $1`, [url, lawFingerprint(await get(url, nameOf(url)))]);
    done.push(url);
  }
  return done;
}
