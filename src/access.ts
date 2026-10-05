import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest { /** Id of the authorised key: `dbkey:<id>` for database keys, `key:...` for env keys; unset when none. */ apiKeyId?: string }
}

export interface AccessOptions {
  /** Accepted API keys. Empty = the API is open (only rate limiting by client IP applies). */
  apiKeys: string[];
  /** Requests per key (or per IP when open) per window; 0 disables rate limiting. */
  perWindow: number;
  windowMs?: number;
  /** The admin token is always accepted as a key. */
  adminToken?: string;
  now?: () => number;
  /** Looks up a presented key that is not in `apiKeys` (e.g. database-managed keys); returns its id and own rate limit. */
  resolveKey?: (key: string) => Promise<{ id: string; ratePerMin: number | null } | null>;
  /** Called once per authorised /v1 request with the key id (`dbkey:<id>` for database keys, `key:...` for env keys); used for metering. */
  onUse?: (id: string) => void;
  /** Shared counter store (several API instances); default is per-process memory. Returns the count in the current window after incrementing. */
  store?: (bucket: string, windowStartSec: number) => Promise<number>;
  /** Require a key on /v1/* even when `apiKeys` is empty (all keys then come from `resolveKey`). */
  requireKey?: boolean;
}

interface Bucket { start: number; count: number }

/**
 * Optional API-key check and fixed-window rate limit for `/v1/*` (health checks and static files are exempt).
 * Keys come from the `x-api-key` header or `Authorization: Bearer <key>`. Responses carry X-RateLimit-* headers;
 * an exhausted window answers 429 with Retry-After. In-memory, per process: put a shared limiter in front when running several instances.
 */
export function installAccessControl(app: FastifyInstance, o: AccessOptions): void {
  const windowMs = o.windowMs ?? 60_000;
  const now = o.now ?? Date.now;
  const keys = new Set([...o.apiKeys.filter(Boolean), ...(o.adminToken ? [o.adminToken] : [])]);
  const buckets = new Map<string, Bucket>();

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/v1/')) return;
    const bearer = typeof req.headers['authorization'] === 'string' ? /^Bearer (.+)$/.exec(req.headers['authorization'])?.[1] : undefined;
    const presented = (typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'] : undefined) ?? bearer;
    let id = presented && keys.has(presented) ? `key:${presented}` : '';
    let limit = o.perWindow;
    if (!id && presented && o.resolveKey) {
      const k = await o.resolveKey(presented);
      if (k) { id = `dbkey:${k.id}`; if (k.ratePerMin !== null) limit = k.ratePerMin; }
    }
    if ((o.apiKeys.length > 0 || o.requireKey) && !id) {
      return reply.code(401).send({ error: 'unauthorized', detail: 'send an API key in the x-api-key header or as a Bearer token' });
    }
    if (id) { req.apiKeyId = id; o.onUse?.(id); }
    if (limit <= 0) return;
    id = id || `ip:${req.ip}`;
    const t = now();
    let count: number;
    let reset: number;
    if (o.store) {
      const startSec = Math.floor(t / windowMs) * (windowMs / 1000);
      count = await o.store(id, startSec);
      reset = Math.max(1, Math.ceil(startSec + windowMs / 1000 - t / 1000));
    } else {
      let b = buckets.get(id);
      if (!b || t - b.start >= windowMs) {
        b = { start: t, count: 0 };
        buckets.set(id, b);
        if (buckets.size > 10_000) for (const [k, v] of buckets) if (t - v.start >= windowMs) buckets.delete(k);
      }
      b.count++;
      count = b.count;
      reset = Math.ceil((b.start + windowMs - t) / 1000);
    }
    reply.header('x-ratelimit-limit', limit).header('x-ratelimit-remaining', Math.max(0, limit - count)).header('x-ratelimit-reset', reset);
    if (count > limit) return reply.code(429).header('retry-after', reset).send({ error: 'rate_limited', retry_after_seconds: reset });
  });
}
