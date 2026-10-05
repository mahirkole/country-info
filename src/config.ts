export const config = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/countryinfo',
  port: Number(process.env.PORT ?? 3000),
  adminToken: process.env.ADMIN_TOKEN ?? '',
  /** Comma-separated API keys; empty = open API. */
  apiKeys: (process.env.API_KEYS ?? '').split(',').map((k) => k.trim()).filter(Boolean),
  /** 'postgres' shares rate-limit counters between API instances (default: per-process memory). */
  rateLimitStore: process.env.RATE_LIMIT_STORE ?? 'memory',
  /** Require an API key on /v1/* even without API_KEYS (keys then come from the admin API). */
  requireApiKey: (process.env.REQUIRE_API_KEY ?? 'false') === 'true',
  /** Requests per key (or IP) per minute; 0 = unlimited. */
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN ?? 600),
  exportDir: process.env.EXPORT_DIR ?? 'out',
  /** Published file bundles (see docs/OPERATIONS.md "Dağıtım"): 'fs' (local directory, signed /dl links) or 's3' (S3-compatible). */
  publishStore: process.env.PUBLISH_STORE ?? 'fs',
  /** Working directory of `publish` (profiles are exported here before upload); with the fs store it is also the storage root. */
  publishDir: process.env.PUBLISH_DIR ?? 'publish',
  publishPrefix: process.env.PUBLISH_PREFIX ?? '',
  /** Public base URL of this API, used in signed download links of the fs store. */
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${Number(process.env.PORT ?? 3000)}`,
  /** HMAC key of fs-store download links; set it when several instances serve files (default: random per process). */
  fileSigningSecret: process.env.FILE_SIGNING_SECRET ?? '',
  s3: { endpoint: process.env.S3_ENDPOINT ?? '', bucket: process.env.S3_BUCKET ?? '', region: process.env.S3_REGION ?? 'us-east-1', accessKey: process.env.S3_ACCESS_KEY ?? '', secretKey: process.env.S3_SECRET_KEY ?? '' },
  /** Operations alerts (Slack/Teams-compatible incoming webhook); empty = log only. */
  notifyUrl: process.env.NOTIFY_WEBHOOK_URL ?? '',
  /** Release digest mails are POSTed as JSON {from,to,subject,text} to this URL; empty = digests are not sent. */
  mailWebhookUrl: process.env.MAIL_WEBHOOK_URL ?? '',
  mailFrom: process.env.MAIL_FROM ?? 'releases@country-info.invalid',
  cacheDir: process.env.CACHE_DIR ?? '.cache',
  /** Size cap of the raw download archive (.cache/raw), oldest files are pruned after a refresh. */
  rawArchiveMaxMb: Number(process.env.RAW_ARCHIVE_MAX_MB ?? 2048),
  ingestAdmin2: (process.env.INGEST_ADMIN2 ?? 'true') !== 'false',
  /** Comma-separated source ids that refresh must skip (e.g. a source whose license is unresolved). */
  disabledSources: (process.env.DISABLE_SOURCES ?? '').split(',').map((x) => x.trim()).filter(Boolean),
  ingestCities: (process.env.INGEST_CITIES ?? 'true') !== 'false',
};
