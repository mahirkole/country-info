import type { FastifyInstance } from 'fastify';

export interface AccessOptions {
  /** Accepted API keys. Empty = the API is open (only rate limiting by client IP applies). */
  apiKeys: string[];
  /** Requests per key (or per IP when open) per window; 0 disables rate limiting. */
  perWindow: number;
  windowMs?: number;
  /** The admin token is always accepted as a key. */
  adminToken?: string;
  now?: () => number;
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
    if (o.apiKeys.length > 0 && !(presented && keys.has(presented))) {
      return reply.code(401).send({ error: 'unauthorized', detail: 'send an API key in the x-api-key header or as a Bearer token' });
    }
    if (o.perWindow <= 0) return;
    const id = presented && keys.has(presented) ? `key:${presented}` : `ip:${req.ip}`;
    const t = now();
    let b = buckets.get(id);
    if (!b || t - b.start >= windowMs) {
      b = { start: t, count: 0 };
      buckets.set(id, b);
      if (buckets.size > 10_000) for (const [k, v] of buckets) if (t - v.start >= windowMs) buckets.delete(k);
    }
    b.count++;
    const reset = Math.ceil((b.start + windowMs - t) / 1000);
    reply.header('x-ratelimit-limit', o.perWindow).header('x-ratelimit-remaining', Math.max(0, o.perWindow - b.count)).header('x-ratelimit-reset', reset);
    if (b.count > o.perWindow) return reply.code(429).header('retry-after', reset).send({ error: 'rate_limited', retry_after_seconds: reset });
  });
}
