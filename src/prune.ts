import type pg from 'pg';

export interface PruneOptions {
  /** Delivered/failed webhook deliveries older than this many days are removed (pending ones never). Default 90. */
  deliveryDays?: number;
  /** api_usage is billing evidence: kept this many days. Default 730. */
  usageDays?: number;
  /** source_runs older than this many days are removed, but the newest `keepRuns` of each source stay. Default 365 / 20. */
  runDays?: number;
  keepRuns?: number;
}

/** Housekeeping for tables that only grow. Returns how many rows each table lost. */
export async function prune(db: pg.Pool, o: PruneOptions = {}): Promise<Record<string, number>> {
  const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rowCount ?? 0;
  return {
    webhook_deliveries: await q("DELETE FROM webhook_deliveries WHERE status IN ('delivered','failed') AND created_at < now() - make_interval(days => $1)", [o.deliveryDays ?? 90]),
    api_usage: await q('DELETE FROM api_usage WHERE day < (now() - make_interval(days => $1))::date', [o.usageDays ?? 730]),
    rate_limits: await q('DELETE FROM rate_limits WHERE window_start < extract(epoch FROM now())::bigint - 3600'),
    source_runs: await q(
      `DELETE FROM source_runs r WHERE r.finished_at < now() - make_interval(days => $1)
         AND r.id NOT IN (SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY source_id ORDER BY id DESC) AS n FROM source_runs) x WHERE x.n <= $2)`,
      [o.runDays ?? 365, o.keepRuns ?? 20],
    ),
  };
}
