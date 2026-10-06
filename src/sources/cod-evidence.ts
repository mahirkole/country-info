import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchText } from './fetch.js';
import { licenseExcerpt } from '../license-watch.js';

/**
 * Licence evidence for the ORIGINAL data owner of each COD-AB country (the national authority named as upstream), kept in
 * docs/licenses/cod-upstream.json. This is evidence, not data: the publisher's own page, a verbatim quote, our verdict and the
 * fingerprint of the page's licensing sentences. A country is loaded only with a green/amber entry whose quote is still on the page.
 */
export interface UpstreamEvidence {
  country: string;
  publisher: string;
  licence_name: string;
  url: string;
  /** Verbatim text from the page (original language). */
  quote: string;
  verdict: 'green' | 'amber' | 'red' | 'unread';
  checked_on: string;
  /** sha256 of `licenseExcerpt(page)` at the time the quote was verified; a different value later means the page changed. */
  page_sha256?: string;
  /** Short statement of what is allowed / required (attribution, restrictions). */
  terms: string;
}

export const EVIDENCE_PATH = new URL('../../docs/licenses/cod-upstream.json', import.meta.url);

const VERDICTS = new Set(['green', 'amber', 'red', 'unread']);

export function parseEvidence(json: string): UpstreamEvidence[] {
  const arr = JSON.parse(json) as unknown;
  if (!Array.isArray(arr)) throw new Error('cod-upstream.json: expected an array');
  const seen = new Set<string>();
  return arr.map((raw, i) => {
    const e = raw as Partial<UpstreamEvidence>;
    const bad = (m: string) => new Error(`cod-upstream.json[${i}] (${e.country ?? '?'}): ${m}`);
    if (!e.country || !/^[A-Z]{2}$/.test(e.country)) throw bad('country must be ISO 3166-1 alpha-2');
    if (seen.has(e.country)) throw bad('duplicate country');
    seen.add(e.country);
    if (!e.verdict || !VERDICTS.has(e.verdict)) throw bad('verdict must be green|amber|red|unread');
    for (const k of ['publisher', 'url', 'quote', 'checked_on', 'terms'] as const) if (!e[k] && (e.verdict === 'green' || e.verdict === 'amber')) throw bad(`${k} is required`);
    if (e.url && !/^https?:\/\//.test(e.url)) throw bad('url must be http(s)');
    return { licence_name: '', publisher: '', url: '', quote: '', checked_on: '', terms: '', ...e } as UpstreamEvidence;
  });
}

export const loadEvidence = (): UpstreamEvidence[] => parseEvidence(readFileSync(EVIDENCE_PATH, 'utf8'));

/** Eligible for loading: the evidence says commercial reuse of the units is allowed (possibly with an unclear condition noted in `terms`). */
export const usable = (e: UpstreamEvidence | undefined): boolean => e?.verdict === 'green' || e?.verdict === 'amber';

/** Page text with markup removed and whitespace/quotes normalised, so a quote can be searched for. */
export const pageText = (html: string): string =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;|[“”«»„]/g, '"').replace(/&#39;|&apos;|[’‘]/g, "'")
    .replace(/\s+/g, ' ').trim();

const norm = (s: string) => pageText(s).toLowerCase();

/** A quote may join several verbatim excerpts of the same page with `[...]` or `|`; every excerpt must be on the page. */
export const quotePieces = (q: string): string[] => q.split(/\s*(?:\[\.\.\.\]|\|)\s*/).map((x) => x.trim()).filter(Boolean);

export interface EvidenceCheck { country: string; quoteFound: boolean; fingerprint: string | null; changed: boolean; error?: string }

/** Second pass: refetch the publisher page, check the quote is still on it and compare the licensing-sentence fingerprint. */
export async function verifyEvidence(e: UpstreamEvidence, get: (url: string) => Promise<string>): Promise<EvidenceCheck> {
  if (e.verdict === 'unread' || !e.url) return { country: e.country, quoteFound: false, fingerprint: null, changed: false };
  try {
    const html = await get(e.url);
    const fp = createHash('sha256').update(licenseExcerpt(html)).digest('hex');
    const text = norm(html);
    return { country: e.country, quoteFound: quotePieces(e.quote).every((q) => text.includes(norm(q))), fingerprint: fp, changed: !!e.page_sha256 && e.page_sha256 !== fp };
  } catch (err) {
    return { country: e.country, quoteFound: false, fingerprint: null, changed: false, error: (err as Error).message };
  }
}

/** Verify every entry; with `write`, store the fingerprint of entries whose quote was found (the initial second pass) and downgrade the rest to unread. */
export async function verifyAll(cacheDir: string, write: boolean): Promise<(EvidenceCheck & { verdict: string })[]> {
  const list = loadEvidence();
  const out: (EvidenceCheck & { verdict: string })[] = [];
  for (const e of list) {
    const r = await verifyEvidence(e, (u) => fetchText(u, `cod_ev_${createHash('md5').update(u).digest('hex').slice(0, 10)}.html`, cacheDir, 0));
    out.push({ ...r, verdict: e.verdict });
    if (write && (e.verdict === 'green' || e.verdict === 'amber')) {
      if (r.quoteFound && r.fingerprint) e.page_sha256 = r.fingerprint;
      else { e.verdict = 'unread'; e.terms = `${e.terms} [second pass failed: ${r.error ?? 'quote not found on the page'}]`.trim(); }
    }
  }
  if (write) writeFileSync(EVIDENCE_PATH, JSON.stringify(list, null, 2) + '\n');
  return out;
}
