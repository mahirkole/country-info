import type pg from 'pg';
import type { RunResult } from './refresh.js';

/** Operations alert: a plain `{ "text": ... }` POST that Slack, Teams and Mattermost incoming webhooks accept. */
export async function notify(url: string | undefined, text: string, send: typeof fetch = fetch): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await send(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(10_000) });
    return res.ok;
  } catch {
    return false;
  }
}

export interface CycleSummary {
  /** Lines that need a person (failed, needs_review, license changed, stale, holiday gaps). */
  attention: string[];
  /** Informational: what changed. */
  changes: string[];
}

/**
 * What to tell the operator after a refresh: failures, sources waiting for review, license changes and stale sources always;
 * a `needs_review` that was already reported by the previous run of the same source is not repeated. Quiet days produce nothing.
 */
export async function summarizeCycle(db: pg.Pool, results: RunResult[]): Promise<CycleSummary> {
  const attention: string[] = [];
  const changes: string[] = [];
  for (const r of results) {
    if (r.status === 'failed') attention.push(`❌ ${r.source}: failed — ${r.detail ?? ''}`);
    else if (r.status === 'needs_review') {
      const prev = (await db.query('SELECT status FROM source_runs WHERE source_id = $1 ORDER BY id DESC LIMIT 1 OFFSET 1', [r.source])).rows[0]?.status;
      if (prev !== 'needs_review') attention.push(`⚠️ ${r.source}: needs review — ${r.detail ?? ''}`);
    } else if (r.status === 'skipped' && /license/.test(r.detail ?? '')) attention.push(`⚖️ ${r.source}: license page changed; read it, then run license:ack`);
    else if (r.status === 'success' && (r.inserted ?? 0) + (r.updated ?? 0) + (r.deleted ?? 0) > 0) changes.push(`✅ ${r.source}: +${r.inserted} ~${r.updated} -${r.deleted}${r.detail ? ` (${r.detail})` : ''}`);
  }
  const stale = (await db.query("SELECT id FROM sources WHERE status = 'license_changed' OR (next_due_at IS NOT NULL AND next_due_at < now() - interval '7 days') ORDER BY id")).rows.map((r) => r.id as string);
  for (const id of stale) if (!attention.some((a) => a.includes(` ${id}:`))) attention.push(`🕓 ${id}: overdue or blocked (see /v1/status)`);
  return { attention, changes };
}

/**
 * From September on, warn for each country whose holiday data does not reach the next year (listed days such as religious holidays
 * must be entered from the official announcement every year).
 */
export async function holidayGaps(db: pg.Pool, now = new Date()): Promise<string[]> {
  if (now.getUTCMonth() < 8) return [];
  const next = now.getUTCFullYear() + 1;
  const rows = (await db.query("SELECT country_code::text AS cc, max((data->>'date')::date) AS last FROM entities WHERE kind = 'holiday' GROUP BY 1 ORDER BY 1")).rows;
  const gaps = rows.filter((r) => new Date(r.last).getUTCFullYear() < next).map((r) => r.cc as string);
  return gaps.length ? [`📅 holiday data does not cover ${next} for: ${gaps.join(', ')}`] : [];
}

export function formatSummary(s: CycleSummary): string {
  return ['country-info refresh', ...s.attention, ...s.changes].join('\n');
}
