import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const USER_AGENT = 'country-info/0.1 (+https://github.com/mahirkole/country-info)';

/** GET `url` as text, caching the body in `cacheDir/name` for `maxAgeMs`. Some publishers reject requests without a User-Agent/Accept. */
export async function fetchText(url: string, name: string, cacheDir: string, maxAgeMs = 24 * 3600 * 1000, headers: Record<string, string> = {}): Promise<string> {
  await mkdir(cacheDir, { recursive: true });
  const path = join(cacheDir, name);
  try {
    if (Date.now() - (await stat(path)).mtimeMs < maxAgeMs) return readFile(path, 'utf8');
  } catch {
    /* not cached */
  }
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, ...headers } });
  let text: string;
  if (res.ok) text = await res.text();
  else if (res.status === 403 || res.status === 406) text = await curlGet(url, headers, res.status); // some WAFs reject Node's client but accept curl
  else throw new Error(`GET ${url}: ${res.status}`);
  await writeFile(path, text);
  return text;
}

/** GET `url` as bytes, caching in `cacheDir/name` for `maxAgeMs`. */
export async function fetchBytes(url: string, name: string, cacheDir: string, maxAgeMs = 24 * 3600 * 1000): Promise<Uint8Array> {
  await mkdir(cacheDir, { recursive: true });
  const path = join(cacheDir, name);
  try {
    if (Date.now() - (await stat(path)).mtimeMs < maxAgeMs) return new Uint8Array(await readFile(path));
  } catch {
    /* not cached */
  }
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  await writeFile(path, buf);
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
