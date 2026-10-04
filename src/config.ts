export const config = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/countryinfo',
  port: Number(process.env.PORT ?? 3000),
  adminToken: process.env.ADMIN_TOKEN ?? '',
  exportDir: process.env.EXPORT_DIR ?? 'out',
  cacheDir: process.env.CACHE_DIR ?? '.cache',
  ingestAdmin2: (process.env.INGEST_ADMIN2 ?? 'true') !== 'false',
  /** Comma-separated source ids that refresh must skip (e.g. a source whose license is unresolved). */
  disabledSources: (process.env.DISABLE_SOURCES ?? '').split(',').map((x) => x.trim()).filter(Boolean),
  ingestCities: (process.env.INGEST_CITIES ?? 'true') !== 'false',
};
