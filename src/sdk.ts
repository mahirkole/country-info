/**
 * Minimal TypeScript client for the country-info API (no dependencies; uses the global `fetch`).
 * Handles the API key, pagination cursors, the change feed cursor and one polite retry after a 429.
 */
export interface ClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
  /** Sleep used for the 429 retry (tests inject a no-op). */
  sleep?: (ms: number) => Promise<void>;
}

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, url: string) {
    super(`${url}: ${status}`);
  }
}

export interface Entity {
  id: string;
  kind: string;
  parent_id: string | null;
  country_code: string;
  code: string;
  name: string;
  data: Record<string, unknown>;
  source_id: string;
  [k: string]: unknown;
}
export interface Page<T> { data: T[]; has_more: boolean; next_after: string | null }
export interface Change { seq: string | number; op: 'insert' | 'update' | 'delete'; entity_id: string; kind: string; country_code: string; changed_fields: string[]; before: unknown; after: unknown }
export interface ChangeFeed { data: Change[]; has_more: boolean; next_seq: number; head_seq: number }
export type Query = Record<string, string | number | boolean | undefined>;

export class CountryInfo {
  private fetchFn: typeof fetch;
  private sleep: (ms: number) => Promise<void>;
  constructor(private o: ClientOptions) {
    this.fetchFn = o.fetchFn ?? fetch;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  get<T>(path: string, query: Query = {}): Promise<T> {
    return this.request<T>('GET', path, undefined, query);
  }

  /** Any call; `body` is sent as JSON. A 204 answers `null`. */
  async request<T>(method: string, path: string, body?: unknown, query: Query = {}): Promise<T> {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    const url = `${this.o.baseUrl.replace(/\/$/, '')}${path}${qs.size ? `?${qs}` : ''}`;
    const headers: Record<string, string> = { accept: 'application/json', ...(this.o.apiKey ? { 'x-api-key': this.o.apiKey } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) };
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchFn(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      if (res.status === 429 && attempt === 0) {
        await this.sleep(Math.min(Number(res.headers.get('retry-after')) || 1, 60) * 1000);
        continue;
      }
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, payload, url);
      return payload as T;
    }
  }

  /** Iterate every item of a paginated list endpoint by following `next_after`. */
  async *paginate<T = Entity>(path: string, query: Query = {}): AsyncGenerator<T> {
    let after: string | undefined;
    for (;;) {
      const page = await this.get<Page<T>>(path, { ...query, after });
      yield* page.data;
      if (!page.has_more || page.next_after == null) return;
      after = String(page.next_after);
    }
  }

  countries = (q: Query = {}) => this.paginate<Entity>('/v1/countries', q);
  country = (code: string) => this.get<Entity & { names: Record<string, string>; xrefs: unknown[] }>(`/v1/countries/${encodeURIComponent(code)}`);
  regions = (code: string, q: Query = {}) => this.paginate<Entity>(`/v1/countries/${encodeURIComponent(code)}/regions`, q);
  divisions = (code: string, q: Query = {}) => this.paginate<Entity>(`/v1/countries/${encodeURIComponent(code)}/divisions`, q);
  region = (id: string) => this.get<Entity & { names: Record<string, string>; xrefs: unknown[]; links: unknown[] }>(`/v1/regions/${encodeURIComponent(id)}`);
  children = (id: string, q: Query = {}) => this.paginate<Entity>(`/v1/regions/${encodeURIComponent(id)}/children`, q);
  search = (q: string, o: Query = {}) => this.get<{ data: Entity[] }>('/v1/search', { q, ...o });
  holidays = (code: string, year?: number, o: Query = {}) => this.get<{ data: Entity[] }>(`/v1/countries/${encodeURIComponent(code)}/holidays`, { year, ...o });
  sources = () => this.get<{ data: Record<string, unknown>[] }>('/v1/sources');
  status = () => this.get<Record<string, unknown>>('/v1/status');

  // ---- scopes, metadata and composed profiles ----------------------------
  scopes = () => this.get<{ schema_version: number; default_scopes: string[]; data: ScopeInfo[] }>('/v1/scopes');
  scope = (id: string) => this.get<Record<string, unknown>>(`/v1/scopes/${encodeURIComponent(id)}`);
  /** Global metadata (no `countries`) or the metadata of the given countries (`mode`: union | intersect). */
  schema = (q: Query = {}) => this.get<Record<string, unknown>>('/v1/schema', q);
  countrySchema = (code: string, q: Query = {}) => this.get<Record<string, unknown>>(`/v1/schema/countries/${encodeURIComponent(code)}`, q);
  /** Data of several countries for the chosen scopes, e.g. `profile({ countries: 'TR,DE', scopes: 'currency,datetime', mode: 'intersect' })`. */
  profile = (q: Query) => this.get<ProfileResult>('/v1/profile', q);
  createScopeProfile = (p: { name: string; scopes?: string[]; countries?: string[]; mode?: 'union' | 'intersect'; locale?: string; default?: boolean }) => this.request<ScopeProfile>('POST', '/v1/scope-profiles', p);
  scopeProfiles = async () => (await this.get<{ data: ScopeProfile[] }>('/v1/scope-profiles')).data;
  deleteScopeProfile = (id: number | string) => this.request<null>('DELETE', `/v1/scope-profiles/${id}`);

  // ---- webhooks (your own subscriptions) -------------------------------
  createWebhook = (w: { url: string; events?: WebhookEvent[]; countries?: string[]; kinds?: string[] }) => this.request<Webhook & { secret: string }>('POST', '/v1/webhooks', w);
  webhooks = async () => (await this.get<{ data: Webhook[] }>('/v1/webhooks')).data;
  deleteWebhook = (id: number | string) => this.request<null>('DELETE', `/v1/webhooks/${id}`);
  /** Delivery log, newest first; pass `before` (`next_before` of the previous page) to continue. */
  webhookDeliveries = (id: number | string, q: Query = {}) => this.get<{ data: Delivery[]; has_more: boolean; next_before: string | null }>(`/v1/webhooks/${id}/deliveries`, q);
  replayDelivery = (id: number | string, deliveryId: number | string) => this.request<{ id: number; status: string }>('POST', `/v1/webhooks/${id}/deliveries/${deliveryId}/replay`);
  testWebhook = (id: number | string) => this.request<{ id: number; status: string }>('POST', `/v1/webhooks/${id}/test`);

  // ---- release notes and file bundles -----------------------------------
  /** Release notes, newest first (follows `next_before`). */
  async *releases(q: Query = {}): AsyncGenerator<ReleaseNote> {
    let before: string | undefined;
    for (;;) {
      const page = await this.get<{ data: ReleaseNote[]; has_more: boolean; next_before: string | null }>('/v1/releases', { ...q, before });
      yield* page.data;
      if (!page.has_more || page.next_before == null) return;
      before = String(page.next_before);
    }
  }
  release = (id: number | string) => this.get<ReleaseNote & { body_md: string }>(`/v1/releases/${id}`);
  exportsLatest = () => this.get<ExportBundle>('/v1/exports/latest');
  /** Download one file of a bundle (`bundle.files[name]` or a snapshot's `delta`) and verify its sha256; throws on mismatch. */
  async download(file: { url: string; sha256: string }): Promise<Uint8Array> {
    const res = await this.fetchFn(file.url);
    if (!res.ok) throw new ApiError(res.status, null, file.url);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const got = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
    if (got !== file.sha256) throw new Error(`sha256 mismatch for ${file.url}: expected ${file.sha256}, got ${got}`);
    return bytes;
  }

  /** Change feed after `since` (0 = from the start); yields changes and returns the cursor to resume from. */
  async *changes(since = 0, q: Query = {}): AsyncGenerator<Change, number> {
    let cursor = since;
    for (;;) {
      const feed = await this.get<ChangeFeed>('/v1/changes', { ...q, since: cursor });
      yield* feed.data;
      cursor = feed.next_seq;
      if (!feed.has_more) return cursor;
    }
  }
}

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

export interface ScopeInfo { id: string; title: string; description: string; applies_to: string[]; default: boolean; availability: Record<string, string>; fields: string[] }
export interface ScopeProfile { id: number; name: string; scopes: string[]; countries: string[] | null; mode: 'union' | 'intersect'; locale: string | null }
export interface ProfileResult { schema_version: number; mode: string; scopes: string[]; countries: string[]; unknown_countries: string[]; data: Record<string, Record<string, Record<string, unknown> | null>>; omitted: { country: string; scope: string; reason: string }[] }
export type WebhookEvent = 'snapshot.completed' | 'release.published' | 'release.retracted';
export interface Webhook { id: number; url: string; events: WebhookEvent[] | null; countries: string[] | null; kinds: string[] | null; active: boolean }
export interface Delivery { id: number; event: string; snapshot_id: number | null; status: 'pending' | 'delivered' | 'failed'; attempts: number; last_error: string | null; payload: Record<string, unknown> }
export interface ReleaseNote { id: number; snapshot_id: number; source_id: string; vintage: string | null; title: string; totals: { inserted: number; updated: number; deleted: number }; countries: Record<string, number>; highlight: boolean; retracted: boolean; created_at: string }
export interface BundleFile { url: string; sha256: string; bytes: number }
export interface ExportBundle { profile: string; snapshot_id: number; from_seq: number; to_seq: number; files: Record<string, BundleFile>; snapshots: { snapshot_id: number; from_seq: number; to_seq: number; delta_only: boolean; delta: BundleFile }[]; retracted: number[] }

/**
 * Check a webhook delivery in your receiver: `signature` is the `x-countryinfo-signature` header, `timestamp` the
 * `x-countryinfo-timestamp` header and `body` the raw request body. Rejects deliveries older than `toleranceSec` (default 300).
 */
export async function verifyWebhook(secret: string, body: string, timestamp: string, signature: string, toleranceSec = 300, nowMs = Date.now()): Promise<boolean> {
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > toleranceSec) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`))));
  const given = signature.replace(/^sha256=/, '');
  if (given.length !== mac.length) return false;
  let diff = 0;
  for (let i = 0; i < mac.length; i++) diff |= mac.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
