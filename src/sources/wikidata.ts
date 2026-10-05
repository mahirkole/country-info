import { USER_AGENT } from './fetch.js';

const ENDPOINT = 'https://query.wikidata.org/sparql';

export type Binding = Record<string, { value: string; 'xml:lang'?: string }>;

export interface SparqlOptions {
  /** Minimum gap between queries (ms). WDQS allows 5 parallel queries per IP; we run one at a time. */
  minIntervalMs?: number;
  retries?: number;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

let lastCall = 0;
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * One SPARQL query against the public Wikidata Query Service with a descriptive User-Agent (required by the
 * service), a serial rate limit, and back-off on 429/503 honouring Retry-After. Queries must finish in 60 s.
 */
export async function sparql(query: string, o: SparqlOptions = {}): Promise<Binding[]> {
  const { minIntervalMs = 1100, retries = 4, fetchFn = fetch, sleep = defaultSleep } = o;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const wait = lastCall + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    try {
      const res = await fetchFn(ENDPOINT, {
        method: 'POST',
        headers: { 'user-agent': USER_AGENT, accept: 'application/sparql-results+json', 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query }).toString(),
        signal: AbortSignal.timeout(70_000),
      });
      if (res.status === 429 || res.status === 503) {
        const after = Number(res.headers.get('retry-after') ?? '') || 5 * 2 ** attempt;
        lastError = new Error(`WDQS ${res.status}`);
        await sleep(after * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`WDQS ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return ((await res.json()) as { results: { bindings: Binding[] } }).results.bindings;
    } catch (e) {
      lastError = e;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const lit = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Items carrying `property` = one of `values`, with their labels in the wanted languages. */
export function lookupQuery(property: string, values: string[], langs: string[]): string {
  return `SELECT ?v ?item ?lang ?label WHERE {
  VALUES ?v { ${values.map(lit).join(' ')} }
  ?item wdt:${property} ?v .
  OPTIONAL { ?item rdfs:label ?label . BIND(LANG(?label) AS ?lang) FILTER(?lang IN (${langs.map(lit).join(', ')})) }
}`;
}

export interface Lookup {
  /** value -> QID(s) (several QIDs for one value means the identifier is ambiguous in Wikidata) */
  qids: Map<string, Set<string>>;
  /** QID -> lang -> label */
  labels: Map<string, Map<string, string>>;
}

export function parseLookup(rows: Binding[]): Lookup {
  const qids = new Map<string, Set<string>>();
  const labels = new Map<string, Map<string, string>>();
  for (const r of rows) {
    const v = r['v']?.value;
    const qid = r['item']?.value.split('/').pop();
    if (!v || !qid || !/^Q\d+$/.test(qid)) continue;
    (qids.get(v) ?? qids.set(v, new Set()).get(v)!).add(qid);
    const lang = r['lang']?.value;
    const label = r['label']?.value;
    if (lang && label) (labels.get(qid) ?? labels.set(qid, new Map()).get(qid)!).set(lang, label);
  }
  return { qids, labels };
}
