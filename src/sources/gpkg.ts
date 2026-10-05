import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type GpkgRow = Record<string, unknown>;

/**
 * Attribute rows of a GeoPackage (SQLite) file, geometry columns left out. Uses the built-in `node:sqlite`
 * (Node >= 22.13, loaded on demand so the rest of the app still runs on older Node).
 * `file` is written to `<dir>/<name>` because SQLite opens paths, not buffers.
 */
export async function readGpkg(bytes: Uint8Array, dir: string, name: string): Promise<Map<string, GpkgRow[]>> {
  await mkdir(dir, { recursive: true });
  const path = join(dir, name);
  await writeFile(path, bytes);
  let sqlite: typeof import('node:sqlite');
  try {
    // require() rather than import(): bundlers/test runners that rewrite `node:` specifiers do not know node:sqlite.
    sqlite = createRequire(import.meta.url)('node:sqlite');
  } catch {
    throw new Error('reading a GeoPackage needs Node >= 22.13 (node:sqlite)');
  }
  const db = new sqlite.DatabaseSync(path, { readOnly: true });
  try {
    const tables = (db.prepare("SELECT table_name FROM gpkg_contents").all() as { table_name: string }[]).map((t) => t.table_name);
    const geom = new Set((db.prepare('SELECT table_name, column_name FROM gpkg_geometry_columns').all() as { table_name: string; column_name: string }[]).map((g) => `${g.table_name}.${g.column_name}`));
    const out = new Map<string, GpkgRow[]>();
    for (const t of tables) {
      const cols = (db.prepare(`PRAGMA table_info("${t.replace(/"/g, '""')}")`).all() as { name: string }[]).map((c) => c.name).filter((c) => !geom.has(`${t}.${c}`));
      if (cols.length === 0) continue;
      out.set(t, db.prepare(`SELECT ${cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(', ')} FROM "${t.replace(/"/g, '""')}"`).all() as GpkgRow[]);
    }
    return out;
  } finally {
    db.close();
  }
}
