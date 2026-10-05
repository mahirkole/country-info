import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type pg from 'pg';
import { config } from './config.js';
import { exportSnapshot, type Manifest, type ManifestEntry } from './export.js';
import { contentTypeOf, FsStore, S3Store, type ObjectStore } from './object-store.js';

export type Profile = 'commercial' | 'full';
export const PROFILES: Profile[] = ['commercial', 'full'];

export function createStore(): ObjectStore | null {
  if (config.publishStore === 's3') {
    const s = config.s3;
    if (!s.endpoint || !s.bucket || !s.accessKey || !s.secretKey) return null;
    return new S3Store({ ...s, prefix: config.publishPrefix });
  }
  return new FsStore(join(config.publishDir, 'store'), config.publicBaseUrl, config.fileSigningSecret || randomBytes(32).toString('hex'));
}

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** Source ids that appear in an exported NDJSON file (one JSON record per line). */
async function sourceIdsIn(file: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
    if (line) ids.add(JSON.parse(line).source_id ?? '(none)');
  }
  return ids;
}

/**
 * Gate for the sold profile: every record in the bundle must come from a source that is cleared for commercial use right now.
 * Throws with the offending source ids; nothing is uploaded after a failure.
 */
export async function verifyCommercialBundle(db: pg.Pool, dir: string, entry: ManifestEntry): Promise<void> {
  const allowed = new Set((await db.query("SELECT id FROM sources WHERE license_verdict IN ('green','amber') AND status <> 'license_changed'")).rows.map((r) => r.id as string));
  const bad = new Set<string>();
  for (const f of ['regions.ndjson', 'holidays.ndjson']) {
    if (!entry.files[f]) continue;
    for (const id of await sourceIdsIn(join(dir, 'snapshots', String(entry.snapshot_id), f))) if (!allowed.has(id)) bad.add(id);
  }
  if (bad.size) throw new Error(`commercial bundle contains records of sources not cleared for sale: ${[...bad].join(', ')}`);
}

async function readManifest(store: ObjectStore, key: string): Promise<Manifest | null> {
  const b = await store.get(key);
  return b ? (JSON.parse(b.toString('utf8')) as Manifest) : null;
}

export interface PublishResult { profile: Profile; snapshots: number[]; uploaded: number }

/**
 * Export what is new since the last published snapshot and upload it. Every pending snapshot gets its delta file; only the newest
 * gets the full data files (the data is as of the head anyway). Uploads go first, `manifest.json` last, so customers never see a
 * manifest that points at files that are not there yet. Sources that are not cleared never enter the `commercial` profile.
 */
export async function publish(db: pg.Pool, store: ObjectStore, workDir: string, opts: { profiles?: Profile[]; log?: (m: string) => void } = {}): Promise<PublishResult[]> {
  const log = opts.log ?? (() => undefined);
  const out: PublishResult[] = [];
  for (const profile of opts.profiles ?? PROFILES) {
    const commercial = profile === 'commercial';
    const dir = join(workDir, profile);
    await mkdir(dir, { recursive: true });
    const remote = await readManifest(store, `${profile}/manifest.json`);
    const through = Math.max(0, ...(remote?.snapshots ?? []).map((s) => s.snapshot_id), ...(remote?.retracted ?? []));
    const pending = (
      await db.query(
        `SELECT s.id FROM snapshots s LEFT JOIN sources o ON o.id = s.source
         WHERE s.finished_at IS NOT NULL AND s.id > $1 AND ($2::boolean = false OR (o.license_verdict IN ('green','amber') AND o.status <> 'license_changed'))
         ORDER BY s.id`,
        [through, commercial],
      )
    ).rows.map((r) => Number(r.id));
    // Nothing new: still make sure a first publish exists (an empty database has no snapshot, so there is nothing to do).
    if (pending.length === 0) { out.push({ profile, snapshots: [], uploaded: 0 }); continue; }
    // A first publish needs only the newest snapshot: older deltas are history nobody has consumed.
    const ids = remote ? pending : [pending[pending.length - 1]!];

    // Continue from the published manifest, not from whatever is on this machine's disk.
    if (remote) await writeFile(join(dir, 'manifest.json'), JSON.stringify(remote, null, 1));
    const entries: ManifestEntry[] = [];
    for (const [i, id] of ids.entries()) entries.push(await exportSnapshot(db, dir, id, { commercialOnly: commercial, deltaOnly: i < ids.length - 1 }));
    const last = entries[entries.length - 1]!;
    if (commercial) await verifyCommercialBundle(db, dir, last);

    let uploaded = 0;
    for (const e of entries) {
      for (const [name, f] of Object.entries(e.files)) {
        const body = await readFile(join(dir, f.path));
        if (sha(body) !== f.sha256) throw new Error(`${f.path}: file changed between export and upload`);
        await store.put(`${profile}/${f.path}`, body, contentTypeOf(name));
        uploaded++;
      }
    }
    await store.put(`${profile}/manifest.json`, await readFile(join(dir, 'manifest.json')), 'application/json');
    log(`${profile}: published snapshots ${ids.join(', ')} (${uploaded} files)`);
    out.push({ profile, snapshots: ids, uploaded });
  }
  return out;
}

/**
 * Emergency lever: point a profile's manifest back at `toSnapshot` and list the later snapshots as retracted. Their files stay in
 * the store (so a link already handed out does not 404) but `latest` no longer names them and a later publish skips them.
 */
export async function rollback(store: ObjectStore, profile: Profile, toSnapshot: number): Promise<number[]> {
  const m = await readManifest(store, `${profile}/manifest.json`);
  if (!m) throw new Error(`no published manifest for ${profile}`);
  const keep = m.snapshots.find((s) => s.snapshot_id === toSnapshot && !s.delta_only);
  if (!keep) throw new Error(`snapshot ${toSnapshot} is not a published full snapshot of ${profile}`);
  const retracted = m.snapshots.filter((s) => s.snapshot_id > toSnapshot).map((s) => s.snapshot_id);
  m.latest = toSnapshot;
  m.retracted = [...new Set([...(m.retracted ?? []), ...retracted])].sort((a, b) => a - b);
  m.snapshots = m.snapshots.filter((s) => s.snapshot_id <= toSnapshot);
  await store.put(`${profile}/manifest.json`, Buffer.from(JSON.stringify(m, null, 1)), 'application/json');
  return retracted;
}

export interface LinkOptions {
  ttlSec?: number;
  /** How many recent snapshots to list. */
  recent?: number;
  /** Countries the key is licensed for; null = all (and the global files). */
  allowed?: string[] | null;
  /** Countries asked for (`?country=`); limited to `allowed` when that is set. */
  countries?: string[];
}

/**
 * What a customer sees: the latest full bundle and recent delta files with short-lived download links. A key licensed for
 * all countries gets the global files; a key restricted to some countries (or a request naming countries) gets the
 * `by_country` file sets instead, so the response stays small and nothing outside the license is linked.
 */
export async function exportLinks(store: ObjectStore, profile: Profile, o: LinkOptions = {}) {
  const [ttlSec, recent] = [o.ttlSec ?? 900, o.recent ?? 30];
  const m = await readManifest(store, `${profile}/manifest.json`);
  if (!m) return null;
  const latest = m.snapshots.find((s) => s.snapshot_id === m.latest);
  if (!latest) return null;
  const link = async (path: string, f: { sha256: string; bytes: number }) => ({ url: await store.presign(`${profile}/${path}`, ttlSec), sha256: f.sha256, bytes: f.bytes });

  const asked = o.countries?.map((c) => c.toUpperCase());
  const selection = o.allowed ? (asked ? asked.filter((c) => o.allowed!.includes(c)) : o.allowed) : asked;
  const global = !selection; // no restriction and no request for specific countries
  const files: Record<string, unknown> = {};
  if (global) for (const [name, f] of Object.entries(latest.files)) if (!name.startsWith('by-country/')) files[name] = await link(f.path, f);
  const by_country: Record<string, { files: Record<string, unknown>; deltas: unknown[] }> = {};
  for (const cc of selection ?? []) {
    const own: Record<string, unknown> = {};
    for (const [name, f] of Object.entries(latest.files)) if (name.startsWith(`by-country/${cc}/`)) own[name.split('/').pop()!] = await link(f.path, f);
    const deltas = [];
    for (const s of m.snapshots.slice(-recent)) {
      const d = s.files[`by-country/${cc}/delta.ndjson`];
      if (d) deltas.push({ snapshot_id: s.snapshot_id, from_seq: s.from_seq, to_seq: s.to_seq, delta: await link(d.path, d) });
    }
    by_country[cc] = { files: own, deltas };
  }
  const snapshots = [];
  for (const s of m.snapshots.slice(-recent)) {
    const d = s.files['delta.ndjson']!;
    snapshots.push({ snapshot_id: s.snapshot_id, from_seq: s.from_seq, to_seq: s.to_seq, created_at: s.created_at, delta_only: !!s.delta_only, ...(global ? { delta: await link(d.path, d) } : {}) });
  }
  return { profile, snapshot_id: latest.snapshot_id, from_seq: latest.from_seq, to_seq: latest.to_seq, created_at: latest.created_at, expires_in_seconds: ttlSec, files, by_country, snapshots, retracted: m.retracted ?? [] };
}
