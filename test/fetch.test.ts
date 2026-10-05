import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import { mkdtemp, readdir, readFile, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fetchBytes, fetchText, fetchPolicy, logBody, pruneArchive, recordFetches } from '../src/sources/fetch.js';

describe('conditional downloads and the raw archive', () => {
  let server: http.Server;
  let base = '';
  const seen: { inm?: string; ims?: string }[] = [];
  let body = 'version one';
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      seen.push({ inm: req.headers['if-none-match'] as string | undefined, ims: req.headers['if-modified-since'] as string | undefined });
      const etag = `"${createHash('md5').update(body).digest('hex')}"`;
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, { etag }); res.end(); return; }
      res.writeHead(200, { etag, 'last-modified': 'Wed, 01 Jan 2025 00:00:00 GMT', 'content-type': 'text/plain' });
      res.end(body);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(() => new Promise((r) => server.close(r)));

  it('sends If-None-Match for a stale cache entry, serves the cache on 304 and refetches after a change', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ft-'));
    expect(await fetchText(`${base}/f`, 'f.txt', dir, 0)).toBe('version one');
    expect(seen[0]).toEqual({ inm: undefined, ims: undefined }); // first download is unconditional
    expect(await fetchText(`${base}/f`, 'f.txt', dir, 0)).toBe('version one');
    expect(seen[1]!.inm).toMatch(/^"/);
    expect(seen[1]!.ims).toBe('Wed, 01 Jan 2025 00:00:00 GMT');
    body = 'version two';
    expect(await fetchText(`${base}/f`, 'f.txt', dir, 0)).toBe('version two');
    expect(new TextDecoder().decode(await fetchBytes(`${base}/f`, 'f.txt', dir, 0))).toBe('version two'); // bytes path: 304 too
    expect(seen.at(-1)!.inm).toBeDefined();
  });

  it('archives every logged body once, by sha256, only while a refresh is recording', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ar-'));
    const raw = join(dir, 'raw');
    logBody('outside a run'); // not recording: nothing is archived
    fetchPolicy.archiveDir = raw;
    const stop = recordFetches();
    logBody('payload A');
    logBody('payload A');
    logBody(new Uint8Array([1, 2, 3]));
    stop();
    fetchPolicy.archiveDir = null;
    const files = (await readdir(raw)).sort();
    expect(files).toHaveLength(2);
    const sha = createHash('sha256').update('payload A').digest('hex');
    expect(files).toContain(sha);
    expect(await readFile(join(raw, sha), 'utf8')).toBe('payload A');
  });

  it('prunes the oldest archived files first until the size cap is met', async () => {
    const raw = await mkdtemp(join(tmpdir(), 'pr-'));
    for (const [i, name] of ['old', 'mid', 'new'].entries()) {
      await writeFile(join(raw, name), 'x'.repeat(100));
      await utimes(raw + '/' + name, new Date(2020, 0, i + 1), new Date(2020, 0, i + 1));
    }
    expect(await pruneArchive(raw, 150)).toBe(2);
    expect(await readdir(raw)).toEqual(['new']);
    expect(await pruneArchive(join(raw, 'missing'), 0)).toBe(0);
  });
});
