export const config = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/countryinfo',
  port: Number(process.env.PORT ?? 3000),
  adminToken: process.env.ADMIN_TOKEN ?? '',
  /** Comma-separated API keys; empty = open API. */
  apiKeys: (process.env.API_KEYS ?? '').split(',').map((k) => k.trim()).filter(Boolean),
  /** Requests per key (or IP) per minute; 0 = unlimited. */
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN ?? 600),
  exportDir: process.env.EXPORT_DIR ?? 'out',
  cacheDir: process.env.CACHE_DIR ?? '.cache',
  /** Size cap of the raw download archive (.cache/raw), oldest files are pruned after a refresh. */
  rawArchiveMaxMb: Number(process.env.RAW_ARCHIVE_MAX_MB ?? 2048),
  ingestAdmin2: (process.env.INGEST_ADMIN2 ?? 'true') !== 'false',
  /** Comma-separated source ids that refresh must skip (e.g. a source whose license is unresolved). */
  disabledSources: (process.env.DISABLE_SOURCES ?? '').split(',').map((x) => x.trim()).filter(Boolean),
  ingestCities: (process.env.INGEST_CITIES ?? 'true') !== 'false',
};
