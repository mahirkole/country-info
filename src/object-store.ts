import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

/** Where published file bundles live. `presign` returns a short-lived URL a customer can download from without credentials. */
export interface ObjectStore {
  put(key: string, body: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  presign(key: string, ttlSec: number): Promise<string>;
}

const hex = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const hmac = (k: Buffer | string, d: string) => createHmac('sha256', k).update(d).digest();
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const encPath = (p: string) => p.split('/').map(enc).join('/');

export interface S3Options {
  /** e.g. https://s3.eu-central-1.amazonaws.com or a MinIO/R2 endpoint; path-style addressing (`<endpoint>/<bucket>/<key>`). */
  endpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  prefix?: string;
  fetch?: typeof fetch;
  now?: () => Date;
}

/** AWS Signature V4 pieces shared by uploads (header auth) and downloads (query auth). */
export function signV4(o: { method: string; host: string; path: string; query?: Record<string, string>; headers?: Record<string, string>; payloadHash: string; accessKey: string; secretKey: string; region: string; amzDate: string }) {
  const day = o.amzDate.slice(0, 8);
  const scope = `${day}/${o.region}/s3/aws4_request`;
  const headers: Record<string, string> = { host: o.host, ...(o.headers ?? {}) };
  const names = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const canonHeaders = names.map((n) => `${n}:${String(Object.entries(headers).find(([k]) => k.toLowerCase() === n)![1]).trim()}\n`).join('');
  const canonQuery = Object.entries(o.query ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&');
  const canonical = [o.method, o.path, canonQuery, canonHeaders, names.join(';'), o.payloadHash].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', o.amzDate, scope, hex(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac('AWS4' + o.secretKey, day), o.region), 's3'), 'aws4_request');
  return { signature: createHmac('sha256', key).update(toSign).digest('hex'), signedHeaders: names.join(';'), scope, canonQuery };
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export class S3Store implements ObjectStore {
  constructor(private o: S3Options) {}
  private target(key: string) {
    const u = new URL(this.o.endpoint);
    const k = [this.o.prefix, key].filter(Boolean).join('/').replace(/\/+/g, '/');
    return { host: u.host, origin: u.origin, path: `${u.pathname.replace(/\/$/, '')}/${enc(this.o.bucket)}/${encPath(k)}` };
  }
  private async call(method: 'PUT' | 'GET', key: string, body?: Buffer, contentType?: string): Promise<Response> {
    const t = this.target(key);
    const amzDate = stamp((this.o.now ?? (() => new Date()))());
    const payloadHash = hex(body ?? '');
    const extra: Record<string, string> = { 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
    const s = signV4({ method, host: t.host, path: t.path, headers: extra, payloadHash, accessKey: this.o.accessKey, secretKey: this.o.secretKey, region: this.o.region, amzDate });
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.o.accessKey}/${s.scope}, SignedHeaders=${s.signedHeaders}, Signature=${s.signature}`;
    return (this.o.fetch ?? fetch)(t.origin + t.path, { method, headers: { ...extra, authorization, ...(contentType ? { 'content-type': contentType } : {}) }, body: body as unknown as BodyInit | undefined, signal: AbortSignal.timeout(10 * 60_000) });
  }
  async put(key: string, body: Buffer, contentType?: string) {
    const res = await this.call('PUT', key, body, contentType);
    if (!res.ok) throw new Error(`S3 PUT ${key}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  async get(key: string) {
    const res = await this.call('GET', key);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`S3 GET ${key}: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  async presign(key: string, ttlSec: number) {
    const t = this.target(key);
    const amzDate = stamp((this.o.now ?? (() => new Date()))());
    const query = { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${this.o.accessKey}/${amzDate.slice(0, 8)}/${this.o.region}/s3/aws4_request`, 'X-Amz-Date': amzDate, 'X-Amz-Expires': String(ttlSec), 'X-Amz-SignedHeaders': 'host' };
    const s = signV4({ method: 'GET', host: t.host, path: t.path, query, payloadHash: 'UNSIGNED-PAYLOAD', accessKey: this.o.accessKey, secretKey: this.o.secretKey, region: this.o.region, amzDate });
    return `${t.origin}${t.path}?${s.canonQuery}&X-Amz-Signature=${s.signature}`;
  }
}

/**
 * Files on local disk, served by the API under `/dl/<key>` with an HMAC-signed, expiring link (see `verifyDownload`).
 * Several API instances must share `secret` and the directory.
 */
export class FsStore implements ObjectStore {
  constructor(private root: string, private baseUrl: string, private secret: string, private now: () => number = Date.now) {}
  private file(key: string): string | null {
    const p = resolve(this.root, key);
    return p === resolve(this.root) || p.startsWith(resolve(this.root) + sep) ? p : null;
  }
  /** Absolute path of a stored key (null for a key that would leave the root). */
  localPath(key: string): string | null {
    return this.file(key);
  }
  async put(key: string, body: Buffer) {
    const p = this.file(key);
    if (!p) throw new Error('bad key');
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  }
  async get(key: string) {
    const p = this.file(key);
    if (!p) return null;
    try {
      return await readFile(p);
    } catch {
      return null;
    }
  }
  private sig(key: string, exp: number) {
    return createHmac('sha256', this.secret).update(`${key}\n${exp}`).digest('hex');
  }
  async presign(key: string, ttlSec: number) {
    const exp = Math.floor(this.now() / 1000) + ttlSec;
    return `${this.baseUrl.replace(/\/$/, '')}/dl/${encPath(key)}?exp=${exp}&sig=${this.sig(key, exp)}`;
  }
  /** True when `sig` matches and the link has not expired. */
  verifyDownload(key: string, exp: string, sig: string): boolean {
    const e = Number(exp);
    if (!Number.isFinite(e) || e * 1000 < this.now()) return false;
    const a = Buffer.from(this.sig(key, e));
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

export const contentTypeOf = (name: string) => (name.endsWith('.json') ? 'application/json' : name.endsWith('.ndjson') ? 'application/x-ndjson' : name.endsWith('.csv') ? 'text/csv' : name.endsWith('.md') ? 'text/markdown' : 'application/octet-stream');
