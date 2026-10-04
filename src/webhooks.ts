import { createHmac } from 'node:crypto';
import type pg from 'pg';

export const MAX_ATTEMPTS = 8;

export function sign(secret: string, body: string, timestamp: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/**
 * Queue one delivery per matching subscription for a finished snapshot. The
 * payload is a notification only; consumers fetch the data from
 * `GET /v1/changes?since=<from_seq>` so webhook bodies stay small.
 */
export async function enqueueDeliveries(db: pg.Pool | pg.PoolClient, snapshotId: number): Promise<number> {
  const snap = (await db.query('SELECT id, source, from_seq, to_seq, inserted, updated, deleted FROM snapshots WHERE id = $1', [snapshotId])).rows[0];
  const perCountry = (
    await db.query('SELECT country_code::text AS cc, count(*)::int AS n FROM changes WHERE snapshot_id = $1 GROUP BY 1', [snapshotId])
  ).rows as { cc: string; n: number }[];
  const subs = (await db.query('SELECT id, countries FROM webhook_subscriptions WHERE active')).rows as { id: number; countries: string[] | null }[];

  let queued = 0;
  for (const s of subs) {
    const matched = s.countries ? perCountry.filter((c) => s.countries!.includes(c.cc)) : perCountry;
    if (matched.length === 0) continue;
    const payload = {
      event: 'snapshot.completed',
      snapshot_id: Number(snap.id),
      source: snap.source,
      from_seq: Number(snap.from_seq),
      to_seq: Number(snap.to_seq),
      totals: { inserted: snap.inserted, updated: snap.updated, deleted: snap.deleted },
      changes_by_country: Object.fromEntries(matched.map((c) => [c.cc, c.n])),
      changes_url: `/v1/changes?since=${snap.from_seq}&until=${snap.to_seq}${s.countries ? `&country=${s.countries.join(',')}` : ''}`,
    };
    await db.query('INSERT INTO webhook_deliveries (subscription_id, snapshot_id, payload) VALUES ($1, $2, $3)', [s.id, snapshotId, JSON.stringify(payload)]);
    queued++;
  }
  return queued;
}

/** Deliver due webhooks once. Returns how many were attempted. Backoff: 30s * 2^attempt. */
export async function processDeliveries(pool: pg.Pool, send: typeof fetch = fetch, now = () => new Date()): Promise<number> {
  const due = (
    await pool.query(
      `SELECT d.id, d.attempts, d.payload, s.url, s.secret
       FROM webhook_deliveries d JOIN webhook_subscriptions s ON s.id = d.subscription_id
       WHERE d.status = 'pending' AND d.next_attempt_at <= now()
       ORDER BY d.id LIMIT 50 FOR UPDATE OF d SKIP LOCKED`,
    )
  ).rows;
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
