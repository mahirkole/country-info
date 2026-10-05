import { createHmac } from 'node:crypto';
import type pg from 'pg';

export const MAX_ATTEMPTS = 8;
/** Events a subscription can filter on (`webhook.test` is always delivered to the subscription that asked for it). */
export const WEBHOOK_EVENTS = ['snapshot.completed', 'release.published', 'release.retracted'] as const;

export function sign(secret: string, body: string, timestamp: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/**
 * Queue one delivery per matching subscription for a finished snapshot. The
 * payload is a notification only; consumers fetch the data from
 * `GET /v1/changes?since=<from_seq>` so webhook bodies stay small.
 */
export async function enqueueDeliveries(db: pg.Pool | pg.PoolClient, snapshotId: number): Promise<number> {
  const snap = (await db.query('SELECT s.id, s.source, s.from_seq, s.to_seq, s.inserted, s.updated, s.deleted, s.reason, src.version AS vintage FROM snapshots s LEFT JOIN sources src ON src.id = s.source WHERE s.id = $1', [snapshotId])).rows[0];
  const perCountryKind = (
    await db.query('SELECT country_code::text AS cc, kind, count(*)::int AS n FROM changes WHERE snapshot_id = $1 GROUP BY 1, 2', [snapshotId])
  ).rows as { cc: string; kind: string; n: number }[];
  const subs = (await db.query('SELECT id, countries, kinds FROM webhook_subscriptions WHERE active AND (events IS NULL OR $1 = ANY(events))', ['snapshot.completed'])).rows as {
    id: number;
    countries: string[] | null;
    kinds: string[] | null;
  }[];

  let queued = 0;
  for (const s of subs) {
    const rows = perCountryKind.filter((c) => (!s.countries || s.countries.includes(c.cc)) && (!s.kinds || s.kinds.includes(c.kind)));
    if (rows.length === 0) continue;
    const matched: { cc: string; n: number }[] = [];
    for (const r of rows) {
      const m = matched.find((x) => x.cc === r.cc);
      if (m) m.n += r.n;
      else matched.push({ cc: r.cc, n: r.n });
    }
    const payload = {
      event: 'snapshot.completed',
      snapshot_id: Number(snap.id),
      source: snap.source,
      source_ids: [snap.source],
      // Release (vintage) the data belongs to, e.g. "ONS April 2025"; `reason` is set when the run applied a vintage change.
      vintage: snap.vintage ?? null,
      reason: snap.reason ?? null,
      from_seq: Number(snap.from_seq),
      to_seq: Number(snap.to_seq),
      totals: { inserted: snap.inserted, updated: snap.updated, deleted: snap.deleted },
      changes_by_country: Object.fromEntries(matched.map((c) => [c.cc, c.n])),
      changes_url: `/v1/changes?since=${snap.from_seq}&until=${snap.to_seq}${s.countries ? `&country=${s.countries.join(',')}` : ''}${s.kinds && s.kinds.length === 1 ? `&kind=${s.kinds[0]}` : ''}`,
    };
    await db.query("INSERT INTO webhook_deliveries (subscription_id, snapshot_id, payload, event) VALUES ($1, $2, $3, 'snapshot.completed')", [s.id, snapshotId, JSON.stringify(payload)]);
    queued++;
  }
  return queued;
}

/**
 * Queue a non-snapshot event (`release.published`, `release.retracted`). `countries` are the countries the event concerns;
 * subscriptions with a country filter only get it when they overlap (an empty list = concerns everyone).
 */
export async function enqueueEvent(db: pg.Pool | pg.PoolClient, event: (typeof WEBHOOK_EVENTS)[number], payload: Record<string, unknown>, opts: { snapshotId?: number; countries?: string[] } = {}): Promise<number> {
  const subs = (await db.query('SELECT id, countries FROM webhook_subscriptions WHERE active AND (events IS NULL OR $1 = ANY(events))', [event])).rows as { id: number; countries: string[] | null }[];
  let queued = 0;
  for (const s of subs) {
    if (s.countries && opts.countries?.length && !opts.countries.some((c) => s.countries!.includes(c))) continue;
    await db.query('INSERT INTO webhook_deliveries (subscription_id, snapshot_id, payload, event) VALUES ($1, $2, $3, $4)', [s.id, opts.snapshotId ?? null, JSON.stringify({ event, ...payload }), event]);
    queued++;
  }
  return queued;
}

/** How long a claimed delivery is invisible to other workers while it is being sent. */
const LEASE_SECONDS = 120;

/** Deliver due webhooks once. Returns how many were attempted. Backoff: 30s * 2^attempt. */
export async function processDeliveries(pool: pg.Pool, send: typeof fetch = fetch, now = () => new Date()): Promise<number> {
  // Claim atomically: the lease pushes next_attempt_at forward, so a second worker (another API instance) skips these rows.
  const due = (
    await pool.query(
      `WITH c AS (
         SELECT d.id FROM webhook_deliveries d JOIN webhook_subscriptions s ON s.id = d.subscription_id
         WHERE d.status = 'pending' AND d.next_attempt_at <= now() AND s.active
         ORDER BY d.id LIMIT 50 FOR UPDATE OF d SKIP LOCKED
       )
       UPDATE webhook_deliveries d SET next_attempt_at = now() + make_interval(secs => $1)
       FROM c, webhook_subscriptions s
       WHERE d.id = c.id AND s.id = d.subscription_id
       RETURNING d.id, d.attempts, d.payload, d.event, s.url, s.secret`,
      [LEASE_SECONDS],
    )
  ).rows.sort((a, b) => Number(a.id) - Number(b.id));
  for (const d of due) {
    const body = JSON.stringify(d.payload);
    const ts = String(Math.floor(now().getTime() / 1000));
    let error: string | null = null;
    try {
      const res = await send(d.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-countryinfo-delivery': String(d.id),
          'x-countryinfo-event': d.event,
          'x-countryinfo-timestamp': ts,
          'x-countryinfo-signature': sign(d.secret, body, ts),
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const attempts = d.attempts + 1;
    if (!error) {
      await pool.query("UPDATE webhook_deliveries SET status='delivered', attempts=$2, delivered_at=now(), last_error=NULL WHERE id=$1", [d.id, attempts]);
    } else if (attempts >= MAX_ATTEMPTS) {
      await pool.query("UPDATE webhook_deliveries SET status='failed', attempts=$2, last_error=$3 WHERE id=$1", [d.id, attempts, error]);
    } else {
      await pool.query(
        "UPDATE webhook_deliveries SET attempts=$2, last_error=$3, next_attempt_at = now() + make_interval(secs => $4) WHERE id=$1",
        [d.id, attempts, error, 30 * 2 ** attempts],
      );
    }
  }
  return due.length;
}
