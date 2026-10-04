export const config = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/countryinfo',
  port: Number(process.env.PORT ?? 3000),
  adminToken: process.env.ADMIN_TOKEN ?? '',
  exportDir: process.env.EXPORT_DIR ?? 'out',
  cacheDir: process.env.CACHE_DIR ?? '.cache',
  ingestAdmin2: (process.env.INGEST_ADMIN2 ?? 'true') !== 'false',
};
