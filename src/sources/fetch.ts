import { mkdir, readFile, writeFile, stat, readdir, unlink } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Default cache lifetime of downloads; `refresh` sets it to 0 so every run sees the publisher's current data. */
export const fetchPolicy: { maxAgeMs: number; /** When set, every body read by an adapter is also stored as `<archiveDir>/<sha256>` (content-addressed raw archive). */ archiveDir: string | null } = { maxAgeMs: 24 * 3600 * 1000, archiveDir: null };

let bodyLog: string[] | null = null;
/** Start recording the sha256 of every body fetched (cached or not); returns a function that stops and yields one combined hash. */
export function recordFetches(): () => string {
  bodyLog = [];
  return () => {
    const hashes = (bodyLog ?? []).slice().sort();
    bodyLog = null;
    return createHash('sha256').update(hashes.join('\n')).digest('hex');
  };
}
/** Adapters that read local files (no download) register their input here too. */
export function logBody(body: string | Uint8Array): void {
  const sha = createHash('sha256').update(body).digest('hex');
  bodyLog?.push(sha);
  if (fetchPolicy.archiveDir && bodyLog) {
    try {
      mkdirSync(fetchPolicy.archiveDir, { recursive: true });
      writeFileSync(`${fetchPolicy.archiveDir}/${sha}`, body, { flag: 'wx' }); // content-addressed: an existing file is identical
    } catch {
      /* already archived, or the archive is unwritable — never fail a refresh over it */
    }
  }
}

/** Delete the oldest archived bodies until the archive is at most `maxBytes`. Returns the number of files removed. */
export async function pruneArchive(dir: string, maxBytes: number): Promise<number> {
  let files: { path: string; size: number; mtime: number }[] = [];
  try {
    files = await Promise.all((await readdir(dir)).map(async (f) => { const st = await stat(`${dir}/${f}`); return { path: `${dir}/${f}`, size: st.size, mtime: st.mtimeMs }; }));
  } catch {
    return 0;
  }
  let total = files.reduce((n, f) => n + f.size, 0);
  let removed = 0;
  for (const f of files.sort((a, b) => a.mtime - b.mtime)) {
    if (total <= maxBytes) break;
    await unlink(f.path);
    total -= f.size;
    removed++;
  }
  return removed;
}

interface CacheMeta { etag?: string; lastModified?: string }
async function readMeta(path: string): Promise<CacheMeta> {
  try {
    return JSON.parse(await readFile(`${path}.meta.json`, 'utf8')) as CacheMeta;
  } catch {
    return {};
  }
}
async function writeMeta(path: string, res: Response): Promise<void> {
  const meta: CacheMeta = { etag: res.headers.get('etag') ?? undefined, lastModified: res.headers.get('last-modified') ?? undefined };
  await writeFile(`${path}.meta.json`, JSON.stringify(meta)).catch(() => undefined);
}
/** Conditional-GET headers for a stale cache entry, so an unchanged publisher file costs a 304 instead of a download. */
async function conditional(path: string): Promise<Record<string, string>> {
  const m = await readMeta(path);
  const h: Record<string, string> = {};
  if (m.etag) h['if-none-match'] = m.etag;
  if (m.lastModified) h['if-modified-since'] = m.lastModified;
  try {
    await stat(path);
  } catch {
    return {}; // nothing cached to fall back on
  }
  return h;
}

export const USER_AGENT = 'country-info/0.1 (+https://github.com/mahirkole/country-info)';

/** GET `url` as text, caching the body in `cacheDir/name` for `maxAgeMs`. Some publishers reject requests without a User-Agent/Accept. */
export async function fetchText(url: string, name: string, cacheDir: string, maxAgeMs = fetchPolicy.maxAgeMs, headers: Record<string, string> = {}): Promise<string> {
  await mkdir(cacheDir, { recursive: true });
  const path = join(cacheDir, name);
  try {
    if (Date.now() - (await stat(path)).mtimeMs < maxAgeMs) {
      const cached = await readFile(path, 'utf8');
      logBody(cached);
      return cached;
    }
  } catch {
    /* not cached */
  }
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, ...(await conditional(path)), ...headers } });
  if (res.status === 304) {
    const cached = await readFile(path, 'utf8'); // unchanged at the publisher
    logBody(cached);
    return cached;
  }
  let text: string;
  if (res.ok) { text = await res.text(); await writeMeta(path, res); }
  else if (res.status === 403 || res.status === 406) text = await curlGet(url, headers, res.status); // some WAFs reject Node's client but accept curl
  else throw new Error(`GET ${url}: ${res.status}`);
  await writeFile(path, text);
  logBody(text);
  return text;
}

/** GET `url` as bytes, caching in `cacheDir/name` for `maxAgeMs`. */
export async function fetchBytes(url: string, name: string, cacheDir: string, maxAgeMs = fetchPolicy.maxAgeMs, headers: Record<string, string> = {}): Promise<Uint8Array> {
  await mkdir(cacheDir, { recursive: true });
  const path = join(cacheDir, name);
  try {
    if (Date.now() - (await stat(path)).mtimeMs < maxAgeMs) {
      const cached = new Uint8Array(await readFile(path));
      logBody(cached);
      return cached;
    }
  } catch {
    /* not cached */
  }
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, ...(await conditional(path)), ...headers } });
  if (res.status === 304) {
    const cached = new Uint8Array(await readFile(path));
    logBody(cached);
    return cached;
  }
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  await writeFile(path, buf);
  await writeMeta(path, res);
  logBody(buf);
  return buf;
}

async function curlGet(url: string, headers: Record<string, string>, status: number): Promise<string> {
  const args = ['-sS', '-L', '-m', '120', '--fail', '-A', USER_AGENT, ...Object.entries(headers).flatMap(([k, v]) => ['-H', `${k}: ${v}`]), url];
  try {
    return (await run('curl', args, { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' })).stdout;
  } catch (e) {
    throw new Error(`GET ${url}: ${status} (curl fallback failed: ${(e as Error).message.split('\n')[0]})`);
  }
}
