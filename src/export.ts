import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, appendFile, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';

const COLS = 'id, kind, parent_id, country_code::text AS country_code, code, name, name_ascii, lat, lon, data';

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csvRow = (cells: unknown[]): string => cells.map(csvCell).join(',') + '\n';

interface ManifestEntry {
  snapshot_id: number;
  to_seq: number;
  from_seq: number;
  created_at: string;
  files: Record<string, { path: string; sha256: string; bytes: number }>;
}

async function sha256(path: string): Promise<{ sha256: string; bytes: number }> {
  const buf = await readFile(path);
  return { sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length };
}

/**
 * Write the files for one snapshot under `<out>/snapshots/<id>/` and refresh
 * `<out>/latest/` and `<out>/manifest.json`:
 *   countries.json / countries.csv   full country list
 *   regions.ndjson                   all subdivisions (admin, NUTS, LAU), one JSON per line
 *   holidays.ndjson / holidays.csv   all holiday occurrences
 *   delta.ndjson                     change log of this snapshot (empty for the first import = all inserts)
 */
export async function exportSnapshot(pool: pg.Pool, outDir: string, snapshotId?: number): Promise<ManifestEntry> {
  const snap = (
    await pool.query(
      snapshotId
        ? 'SELECT id, from_seq, to_seq, finished_at FROM snapshots WHERE id = $1'
        : 'SELECT id, from_seq, to_seq, finished_at FROM snapshots WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1',
      snapshotId ? [snapshotId] : [],
    )
  ).rows[0];
  if (!snap) throw new Error('no snapshot to export; run ingest first');

  const dir = join(outDir, 'snapshots', String(snap.id));
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  // Export the data as of the current head. Snapshots are cumulative, so files
  // for an old snapshot id reflect the database now; deltas are what is per-snapshot.
  const countries = (await pool.query(`SELECT ${COLS} FROM entities WHERE kind = 'country' ORDER BY code`)).rows;
  await writeFile(join(dir, 'countries.json'), JSON.stringify(countries, null, 1));
  const header = ['code', 'iso3', 'numeric', 'name', 'capital', 'continent', 'un_status', 'currency_code', 'phone_code', 'languages', 'tld', 'population', 'area_km2'];
  await writeFile(
    join(dir, 'countries.csv'),
    csvRow(header) +
      countries.map((c) => csvRow([c.code, c.data.iso3, c.data.numeric, c.name, c.data.capital, c.data.continent, c.data.un_status, c.data.currency?.code, c.data.phone_code, (c.data.languages ?? []).join(' '), c.data.tld, c.data.population, c.data.area_km2])).join(''),
  );

  await writeFile(join(dir, 'regions.ndjson'), '');
  for (let after = ''; ; ) {
    const rows = (await pool.query(`SELECT ${COLS} FROM entities WHERE kind NOT IN ('country', 'holiday') AND id > $1 ORDER BY id LIMIT 5000`, [after])).rows;
    if (rows.length === 0) break;
    await appendFile(join(dir, 'regions.ndjson'), rows.map((r) => JSON.stringify(r) + '\n').join(''));
    after = rows[rows.length - 1].id;
  }

  await writeFile(join(dir, 'holidays.ndjson'), '');
  const hcsv = join(dir, 'holidays.csv');
  await writeFile(hcsv, csvRow(['date', 'country', 'rule_id', 'name', 'type', 'region', 'verification', 'source']));
  for (let after = ''; ; ) {
    const rows = (await pool.query(`SELECT ${COLS} FROM entities WHERE kind = 'holiday' AND id > $1 ORDER BY id LIMIT 5000`, [after])).rows;
    if (rows.length === 0) break;
    await appendFile(join(dir, 'holidays.ndjson'), rows.map((r) => JSON.stringify(r) + '\n').join(''));
    await appendFile(hcsv, rows.map((r) => csvRow([r.data.date, r.country_code, r.data.rule_id, r.name, r.data.type, r.data.region, r.data.verification, r.data.source?.citation])).join(''));
    after = rows[rows.length - 1].id;
  }

  await writeFile(join(dir, 'delta.ndjson'), '');
  for (let after = Number(snap.from_seq); ; ) {
    const rows = (
      await pool.query(
        `SELECT seq, entity_id, kind, country_code::text AS country_code, op, changed_fields, before, after FROM changes WHERE snapshot_id = $1 AND seq > $2 ORDER BY seq LIMIT 5000`,
        [snap.id, after],
      )
    ).rows;
    if (rows.length === 0) break;
    await appendFile(join(dir, 'delta.ndjson'), rows.map((r) => JSON.stringify(r) + '\n').join(''));
    after = Number(rows[rows.length - 1].seq);
  }

  const files: ManifestEntry['files'] = {};
  for (const f of ['countries.json', 'countries.csv', 'regions.ndjson', 'holidays.ndjson', 'holidays.csv', 'delta.ndjson']) {
    files[f] = { path: `snapshots/${snap.id}/${f}`, ...(await sha256(join(dir, f))) };
  }
  const entry: ManifestEntry = { snapshot_id: Number(snap.id), from_seq: Number(snap.from_seq), to_seq: Number(snap.to_seq), created_at: new Date(snap.finished_at ?? Date.now()).toISOString(), files };

  await rm(join(outDir, 'latest'), { recursive: true, force: true });
  await cp(dir, join(outDir, 'latest'), { recursive: true });

  let manifest: { latest: number; snapshots: ManifestEntry[] } = { latest: entry.snapshot_id, snapshots: [] };
  try {
    manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8'));
  } catch {
    /* first export */
  }
  manifest.snapshots = [...manifest.snapshots.filter((s) => s.snapshot_id !== entry.snapshot_id), entry].sort((a, b) => a.snapshot_id - b.snapshot_id);
  manifest.latest = manifest.snapshots[manifest.snapshots.length - 1]!.snapshot_id;
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return entry;
}
