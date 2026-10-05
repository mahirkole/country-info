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
    super(`GET ${url}: ${status}`);
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

  async get<T>(path: string, query: Query = {}): Promise<T> {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    const url = `${this.o.baseUrl.replace(/\/$/, '')}${path}${qs.size ? `?${qs}` : ''}`;
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchFn(url, { headers: this.o.apiKey ? { 'x-api-key': this.o.apiKey, accept: 'application/json' } : { accept: 'application/json' } });
      if (res.status === 429 && attempt === 0) {
        await this.sleep(Math.min(Number(res.headers.get('retry-after')) || 1, 60) * 1000);
        continue;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, body, url);
      return body as T;
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
