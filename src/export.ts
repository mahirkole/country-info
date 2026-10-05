import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, appendFile, cp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';

/** UN status of a country: read from CLDR (xref scheme `un_status`, written by enrich:cldr); null until that has run. */
export const UN_SQL = "(SELECT x.value FROM entity_xrefs x WHERE x.entity_id = entities.id AND x.scheme = 'un_status' AND x.source = 'cldr' LIMIT 1)";
/** Put the xref-derived `un_status` (selected as `un_x`) into a country row's `data`. */
export const withUn = <T extends { data: Record<string, unknown>; un_x?: unknown }>(r: T): Omit<T, 'un_x'> => {
  const { un_x, ...rest } = r;
  return { ...rest, data: { ...rest.data, un_status: (un_x as string | null | undefined) ?? null } };
};

const COLS = 'id, kind, parent_id, country_code::text AS country_code, code, name, name_ascii, lat, lon, data, source_id';

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csvRow = (cells: unknown[]): string => cells.map(csvCell).join(',') + '\n';

export interface ManifestEntry {
  snapshot_id: number;
  to_seq: number;
  from_seq: number;
  created_at: string;
  files: Record<string, { path: string; sha256: string; bytes: number }>;
  /** Only delta.ndjson and ATTRIBUTION.md were written (an intermediate snapshot of a publish run). */
  delta_only?: boolean;
}

export interface Manifest {
  latest: number;
  snapshots: ManifestEntry[];
  /** Snapshot ids withdrawn by a rollback; a publish run does not export them again. */
  retracted?: number[];
}

/** Append rows to `<dir>/by-country/<CC>/<file>` (one file set per country, for customers licensed for a few countries). */
async function appendByCountry(dir: string, file: string, rows: { country_code: string | null }[]): Promise<void> {
  const groups = new Map<string, string>();
  for (const r of rows) if (r.country_code) groups.set(r.country_code, (groups.get(r.country_code) ?? '') + JSON.stringify(r) + '\n');
  for (const [cc, text] of groups) {
    await mkdir(join(dir, 'by-country', cc), { recursive: true });
    await appendFile(join(dir, 'by-country', cc, file), text);
  }
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
export interface ExportOptions {
  /**
   * Leave out every record whose source is not cleared for commercial use (license verdict other than
   * green/amber, including unknown). Use this profile for anything that is sold or redistributed.
   */
  commercialOnly?: boolean;
  /** Write only the delta and the attribution file (for snapshots between two full exports). */
  deltaOnly?: boolean;
}

export async function exportSnapshot(pool: pg.Pool, outDir: string, snapshotId?: number, opts: ExportOptions = {}): Promise<ManifestEntry> {
  // A source whose license page changed is blocked until a person has read the new terms: it stays out of the sold profile meanwhile.
  const ok = (a: string) => `${a}.license_verdict IN ('green','amber') AND ${a}.status <> 'license_changed'`;
  const cleared = opts.commercialOnly ? `AND source_id IN (SELECT o.id FROM sources o WHERE ${ok('o')})` : '';
  const clearedSnap = opts.commercialOnly ? `AND snapshot_id IN (SELECT s.id FROM snapshots s JOIN sources o ON o.id = s.source WHERE ${ok('o')})` : '';
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
  if (!opts.deltaOnly) {
    const countries = (await pool.query(`SELECT ${COLS}, ${UN_SQL} AS un_x FROM entities WHERE kind = 'country' ${cleared} ORDER BY code`)).rows.map(withUn);
    await writeFile(join(dir, 'countries.json'), JSON.stringify(countries, null, 1));
    for (const c of countries) {
      await mkdir(join(dir, 'by-country', c.code), { recursive: true });
      await writeFile(join(dir, 'by-country', c.code, 'country.json'), JSON.stringify(c, null, 1));
      // Every country has the same file set (empty when it has no regions/holidays), so a client never has to guess.
      await writeFile(join(dir, 'by-country', c.code, 'regions.ndjson'), '');
      await writeFile(join(dir, 'by-country', c.code, 'holidays.ndjson'), '');
    }
    const header = ['code', 'iso3', 'numeric', 'name', 'capital', 'continent', 'un_status', 'currency_code', 'phone_code', 'languages', 'tld', 'population', 'area_km2'];
    await writeFile(
      join(dir, 'countries.csv'),
      csvRow(header) +
        countries.map((c) => csvRow([c.code, c.data.iso3, c.data.numeric, c.name, c.data.capital, c.data.continent, c.data.un_status, c.data.currency?.code, c.data.phone_code, (c.data.languages ?? []).join(' '), c.data.tld, c.data.population, c.data.area_km2])).join(''),
    );

    await writeFile(join(dir, 'regions.ndjson'), '');
    for (let after = ''; ; ) {
      const rows = (await pool.query(`SELECT ${COLS} FROM entities WHERE kind NOT IN ('country', 'holiday') ${cleared} AND id > $1 ORDER BY id LIMIT 5000`, [after])).rows;
      if (rows.length === 0) break;
      await appendFile(join(dir, 'regions.ndjson'), rows.map((r) => JSON.stringify(r) + '\n').join(''));
      await appendByCountry(dir, 'regions.ndjson', rows);
      after = rows[rows.length - 1].id;
    }

    await writeFile(join(dir, 'holidays.ndjson'), '');
    const hcsv = join(dir, 'holidays.csv');
    await writeFile(hcsv, csvRow(['date', 'country', 'rule_id', 'name', 'type', 'region', 'verification', 'source']));
    for (let after = ''; ; ) {
      const rows = (await pool.query(`SELECT ${COLS} FROM entities WHERE kind = 'holiday' ${cleared} AND id > $1 ORDER BY id LIMIT 5000`, [after])).rows;
      if (rows.length === 0) break;
      await appendFile(join(dir, 'holidays.ndjson'), rows.map((r) => JSON.stringify(r) + '\n').join(''));
      await appendByCountry(dir, 'holidays.ndjson', rows);
      await appendFile(hcsv, rows.map((r) => csvRow([r.data.date, r.country_code, r.data.rule_id, r.name, r.data.type, r.data.region, r.data.verification, r.data.source?.citation])).join(''));
      after = rows[rows.length - 1].id;
    }
  }

  await writeFile(join(dir, 'delta.ndjson'), '');
  for (let after = Number(snap.from_seq); ; ) {
    const rows = (
      await pool.query(
        `SELECT seq, entity_id, kind, country_code::text AS country_code, op, changed_fields, before, after FROM changes WHERE snapshot_id = $1 ${clearedSnap} AND seq > $2 ORDER BY seq LIMIT 5000`,
        [snap.id, after],
      )
    ).rows;
    if (rows.length === 0) break;
    await appendFile(join(dir, 'delta.ndjson'), rows.map((r) => JSON.stringify(r) + '\n').join(''));
    await appendByCountry(dir, 'delta.ndjson', rows);
    after = Number(rows[rows.length - 1].seq);
  }

  const sources = (await pool.query(`SELECT id, authority, url, license, version, attribution FROM sources o ${opts.commercialOnly ? `WHERE ${ok('o')}` : ''} ORDER BY id`)).rows;
  await writeFile(
    join(dir, 'ATTRIBUTION.md'),
    '# Data sources and attribution\n\nIf you redistribute this data, keep the credit lines below.\n\n' +
      sources.map((s) => `## ${s.id}\n- Authority: ${s.authority}\n- License: ${s.license ?? 'n/a'}\n${s.version ? `- Version: ${s.version}\n` : ''}${s.url ? `- URL: ${s.url}\n` : ''}- Credit: ${s.attribution ?? '(none required)'}\n`).join('\n'),
  );

  const files: ManifestEntry['files'] = {};
  for (const f of opts.deltaOnly ? ['ATTRIBUTION.md', 'delta.ndjson'] : ['countries.json', 'countries.csv', 'regions.ndjson', 'holidays.ndjson', 'holidays.csv', 'ATTRIBUTION.md', 'delta.ndjson']) {
    files[f] = { path: `snapshots/${snap.id}/${f}`, ...(await sha256(join(dir, f))) };
  }
  // Per-country files (only those that exist: a delta file only for countries with changes in this snapshot).
  for (const cc of await readdir(join(dir, 'by-country')).catch(() => [] as string[])) {
    for (const f of await readdir(join(dir, 'by-country', cc))) files[`by-country/${cc}/${f}`] = { path: `snapshots/${snap.id}/by-country/${cc}/${f}`, ...(await sha256(join(dir, 'by-country', cc, f))) };
  }
  const entry: ManifestEntry = { snapshot_id: Number(snap.id), from_seq: Number(snap.from_seq), to_seq: Number(snap.to_seq), created_at: new Date(snap.finished_at ?? Date.now()).toISOString(), files, ...(opts.deltaOnly ? { delta_only: true } : {}) };

  if (!opts.deltaOnly) {
    await rm(join(outDir, 'latest'), { recursive: true, force: true });
    await cp(dir, join(outDir, 'latest'), { recursive: true });
  }

  let manifest: Manifest = { latest: entry.snapshot_id, snapshots: [] };
  try {
    manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8'));
  } catch {
    /* first export */
  }
  manifest.snapshots = [...manifest.snapshots.filter((s) => s.snapshot_id !== entry.snapshot_id), entry].sort((a, b) => a.snapshot_id - b.snapshot_id);
  manifest.latest = [...manifest.snapshots].reverse().find((x) => !x.delta_only)?.snapshot_id ?? entry.snapshot_id;
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return entry;
}
