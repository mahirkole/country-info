/**
 * OpenAPI 3.0 description of the public API. Hand-maintained; a test (test/db.test.ts) fails when a registered
 * /v1 route is missing here or this file documents a route that does not exist.
 */
type Param = { name: string; description: string; required?: boolean };
interface Op { method: 'get' | 'post' | 'delete'; path: string; summary: string; query?: Param[]; admin?: boolean; tag: string }

const page: Param[] = [{ name: 'limit', description: 'Page size (1–1000, default 100)' }, { name: 'after', description: 'Cursor: id of the last item of the previous page' }];
const scope: Param[] = [
  { name: 'official_only', description: 'true: only records of official sources (national statistics, Eurostat), no community data' },
  { name: 'canonical', description: 'true: when records of several sources are linked, only the best-sourced one (official > Wikidata layer > GeoNames)' },
];

export const OPERATIONS: Op[] = [
  { method: 'get', path: '/v1/countries', tag: 'countries', summary: 'List countries', query: [...page, { name: 'un_status', description: 'UN membership filter' }, { name: 'continent', description: 'Continent code' }] },
  { method: 'get', path: '/v1/countries/{code}', tag: 'countries', summary: 'One country (names in many languages, currency xref)' },
  { method: 'get', path: '/v1/countries/{code}/regions', tag: 'regions', summary: 'First- or second-level regions of a country', query: [...page, ...scope, { name: 'level', description: '1 or 2' }] },
  { method: 'get', path: '/v1/countries/{code}/divisions', tag: 'regions', summary: 'Administrative divisions from national sources', query: [...page, ...scope, { name: 'level', description: 'Level within the source' }, { name: 'type', description: 'Common type: state, province, county, municipality, …' }, { name: 'source', description: 'Source id, e.g. nat-fr' }] },
  { method: 'get', path: '/v1/countries/{code}/holidays', tag: 'holidays', summary: 'Public holidays of a country and year', query: [{ name: 'year', description: 'Year (default current)' }, { name: 'region', description: 'Region id for regional holidays' }, { name: 'type', description: 'Holiday type' }] },
  { method: 'get', path: '/v1/holidays', tag: 'holidays', summary: 'Holidays on a date', query: [{ name: 'date', description: 'YYYY-MM-DD', required: true }, { name: 'country', description: 'ISO alpha-2' }] },
  { method: 'get', path: '/v1/holidays/coverage', tag: 'holidays', summary: 'Per-country holiday coverage and verification status' },
  { method: 'get', path: '/v1/regions/{id}', tag: 'regions', summary: 'One region with names, cross references and links to other sources' },
  { method: 'get', path: '/v1/regions/{id}/children', tag: 'regions', summary: 'Children of a region', query: [...page, ...scope] },
  { method: 'get', path: '/v1/search', tag: 'regions', summary: 'Search by name prefix', query: [{ name: 'q', description: 'Name prefix', required: true }, { name: 'country', description: 'ISO alpha-2' }, { name: 'kind', description: 'Entity kind' }, { name: 'limit', description: 'Max results' }, ...scope] },
  { method: 'get', path: '/v1/regions/{id}/successors', tag: 'regions', summary: 'Confirmed successors and predecessors of a unit across releases (works for ids that no longer exist)' },
  { method: 'post', path: '/v1/review-items/{id}/resolve', tag: 'admin', summary: 'Accept or dismiss a review item (accepting a successor suggestion records the relation)', admin: true },
  { method: 'get', path: '/v1/review-items', tag: 'admin', summary: 'Open source conflicts for review', admin: true, query: [{ name: 'status', description: 'open, accepted_a, accepted_b, dismissed' }, { name: 'limit', description: 'Max results' }] },
  { method: 'get', path: '/v1/sources', tag: 'provenance', summary: 'Sources with license, attribution, freshness and class' },
  { method: 'get', path: '/v1/status', tag: 'provenance', summary: 'Health of the data pipeline (stale or failing sources)' },
  { method: 'get', path: '/v1/snapshots', tag: 'changes', summary: 'Published snapshots' },
  { method: 'get', path: '/v1/changes', tag: 'changes', summary: 'Change feed after a cursor (insert/update/delete with before/after)', query: [{ name: 'since', description: 'Cursor (seq), 0 = from the start' }, { name: 'until', description: 'Upper bound (seq)' }, { name: 'country', description: 'Comma-separated ISO alpha-2' }, { name: 'kind', description: 'Entity kind' }, { name: 'limit', description: 'Page size' }] },
  { method: 'post', path: '/v1/api-keys', tag: 'admin', summary: 'Create an API key (the key is returned once; optional per-key rate_per_min)', admin: true },
  { method: 'get', path: '/v1/api-keys', tag: 'admin', summary: 'List API keys (no secrets)', admin: true },
  { method: 'get', path: '/v1/api-keys/usage', tag: 'admin', summary: 'Requests per API key and day (key_id 0 = env keys / admin token)', admin: true, query: [{ name: 'from', description: 'YYYY-MM-DD' }, { name: 'to', description: 'YYYY-MM-DD' }] },
  { method: 'delete', path: '/v1/api-keys/{id}', tag: 'admin', summary: 'Revoke an API key', admin: true },
  { method: 'post', path: '/v1/webhooks', tag: 'webhooks', summary: 'Subscribe a URL to signed notifications (events: snapshot.completed, release.published, release.retracted; optional countries/kinds filters). The signing secret is returned once. A database API key owns its subscriptions; the admin token manages all.' },
  { method: 'get', path: '/v1/webhooks', tag: 'webhooks', summary: 'List your webhook subscriptions (admin: all)' },
  { method: 'delete', path: '/v1/webhooks/{id}', tag: 'webhooks', summary: 'Remove a webhook subscription' },
  { method: 'get', path: '/v1/webhooks/{id}/deliveries', tag: 'webhooks', summary: 'Delivery log of a subscription, newest first (status, attempts, last error, payload)', query: [{ name: 'limit', description: 'Page size (1–200)' }, { name: 'before', description: 'Cursor: id of the last item of the previous page' }, { name: 'status', description: 'pending, delivered, failed' }] },
  { method: 'post', path: '/v1/webhooks/{id}/deliveries/{did}/replay', tag: 'webhooks', summary: 'Send a delivery again (queued as a copy)' },
  { method: 'post', path: '/v1/webhooks/{id}/test', tag: 'webhooks', summary: 'Queue a webhook.test event to check the endpoint and signature' },
  { method: 'get', path: '/v1/releases', tag: 'releases', summary: 'Release notes of applied updates (customer-visible sources only), newest first', query: [{ name: 'limit', description: 'Page size' }, { name: 'before', description: 'Cursor: id of the last item of the previous page' }] },
  { method: 'get', path: '/v1/releases/{id}', tag: 'releases', summary: 'One release note (Markdown body, totals, countries)' },
  { method: 'get', path: '/v1/exports/latest', tag: 'exports', summary: 'Latest file bundle for your key profile: manifest entry and short-lived signed download links' },
  { method: 'post', path: '/v1/release-subscribers', tag: 'admin', summary: 'Subscribe an e-mail address to release digests (instant or weekly)', admin: true },
  { method: 'get', path: '/v1/release-subscribers', tag: 'admin', summary: 'List release-digest subscribers', admin: true },
  { method: 'delete', path: '/v1/release-subscribers/{id}', tag: 'admin', summary: 'Remove a release-digest subscriber', admin: true },
];

export function openApiSpec(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of OPERATIONS) {
    const pathParams = [...op.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1]!, in: 'path', required: true, schema: { type: 'string' } }));
    const query = (op.query ?? []).map((q) => ({ name: q.name, in: 'query', required: !!q.required, description: q.description, schema: { type: 'string' } }));
    (paths[op.path] ??= {})[op.method] = {
      tags: [op.tag],
      summary: op.summary,
      parameters: [...pathParams, ...query],
      security: [op.admin ? { adminToken: [] } : { apiKey: [] }, ...(op.admin ? [] : [{}])],
      responses: { '200': { description: 'OK' }, '401': { description: 'Missing or invalid key' }, '429': { description: 'Rate limit exceeded (see Retry-After)' } },
    };
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'country-info API',
      version: '1.0.0',
      description: 'Countries, administrative divisions and public holidays from official sources, with provenance (source, license, attribution) and a change feed. Every record carries `source_id`; see /v1/sources for the required attribution. Data licences differ per source; the commercial export profile excludes sources whose licence is not green/amber.',
    },
    paths,
    components: {
      securitySchemes: {
        apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'Required when the server is configured with API_KEYS; a Bearer token is accepted too.' },
        adminToken: { type: 'http', scheme: 'bearer', description: 'ADMIN_TOKEN, for review items, API keys and release subscribers; also accepted on webhook endpoints (sees all subscriptions).' },
      },
    },
  };
}
