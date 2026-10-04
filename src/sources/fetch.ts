import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** GET `url` as text, caching the body in `cacheDir/name` for `maxAgeMs`. */
export async function fetchText(url: string, name: string, cacheDir: string, maxAgeMs = 24 * 3600 * 1000): Promise<string> {
  await mkdir(cacheDir, { recursive: true });
  const path = join(cacheDir, name);
  try {
    if (Date.now() - (await stat(path)).mtimeMs < maxAgeMs) return readFile(path, 'utf8');
  } catch {
    /* not cached */
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  const text = await res.text();
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  await writeFile(path, buf);
  return buf;
}
