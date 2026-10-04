import { createHash } from 'node:crypto';
import type pg from 'pg';
import { fetchText } from './sources/fetch.js';
import type { RefreshTarget } from './targets.js';

const KEYWORDS = /licen[cs]e|licenza|lisens|creative commons|cc[ -]by|copyright|commercial|reuse|re-use|open data|open government|terms of use|use constraints|åpne data|naamsvermelding|attribuzione|licence ouverte/i;

/**
 * The sentences of a page that talk about licensing, whitespace-normalized and de-duplicated.
 * Hashing only these keeps the fingerprint stable against menus, dates and cookie banners.
 */
export function licenseExcerpt(htmlOrText: string): string {
  const lines = htmlOrText
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?(p|div|li|ul|ol|br|h[1-6]|nav|tr|td|th|section|article|header|footer|main|aside|table|form)\b[^>]*>/gi, '\n') // block boundaries end a sentence
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim());
  const sentences = lines.flatMap((l) => l.split(/(?<=[.!?])\s+/)).map((x) => x.trim()).filter((x) => x.length > 20 && KEYWORDS.test(x));
  return [...new Set(sentences)].sort().join('\n');
}

export const fingerprint = (excerpt: string) => createHash('sha256').update(excerpt).digest('hex');

export interface LicenseCheck {
  source: string;
  status: 'baseline' | 'unchanged' | 'changed' | 'no-pages' | 'error';
  detail?: string;
}

async function currentFingerprint(urls: string[], cacheDir: string): Promise<string> {
  const parts: string[] = [];
  for (const u of urls) parts.push(licenseExcerpt(await fetchText(u, `lic_${createHash('md5').update(u).digest('hex').slice(0, 10)}.html`, cacheDir, 0)));
  if (parts.every((p) => p === '')) throw new Error('no licensing sentences found on the license pages (page layout changed or blocked)');
  return fingerprint(parts.join('\n--\n'));
}

/** Compare each source's license pages with the stored fingerprint; a change blocks refresh until `ackLicense`. */
export async function checkLicenses(pool: pg.Pool, targets: RefreshTarget[], cacheDir: string): Promise<LicenseCheck[]> {
  const out: LicenseCheck[] = [];
  for (const t of targets) {
    const id = t.meta.id;
    if (t.licenseUrls.length === 0) {
      out.push({ source: id, status: 'no-pages' });
      continue;
    }
    try {
      const fp = await currentFingerprint(t.licenseUrls, cacheDir);
      const row = (await pool.query('SELECT license_page_sha256 FROM sources WHERE id = $1', [id])).rows[0];
      const stored: string | null = row?.license_page_sha256 ?? null;
      if (stored === null) {
        await pool.query('UPDATE sources SET license_page_sha256 = $2, license_checked_at = now() WHERE id = $1', [id, fp]);
        out.push({ source: id, status: 'baseline' });
      } else if (stored === fp) {
        await pool.query('UPDATE sources SET license_checked_at = now() WHERE id = $1', [id]);
        out.push({ source: id, status: 'unchanged' });
      } else {
        await pool.query("UPDATE sources SET status = 'license_changed', license_checked_at = now() WHERE id = $1", [id]);
        out.push({ source: id, status: 'changed', detail: `license page fingerprint ${stored.slice(0, 8)} -> ${fp.slice(0, 8)}` });
      }
    } catch (e) {
      out.push({ source: id, status: 'error', detail: (e as Error).message });
    }
  }
  return out;
}

/** After a human re-read the license pages: store the new fingerprint and unblock the source. */
export async function ackLicense(pool: pg.Pool, target: RefreshTarget, cacheDir: string): Promise<void> {
  const fp = await currentFingerprint(target.licenseUrls, cacheDir);
  await pool.query("UPDATE sources SET license_page_sha256 = $2, license_checked_at = now(), status = 'ok' WHERE id = $1", [target.meta.id, fp]);
}
