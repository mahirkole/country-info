import type pg from 'pg';
import { enqueueEvent } from './webhooks.js';

/** Changes of one snapshot summarised for people: a Markdown note, stored once, shown to customers when the source is cleared for sale. */
export async function createReleaseNote(db: pg.Pool, snapshotId: number, extra: { detail?: string } = {}): Promise<number | null> {
  const snap = (
    await db.query(
      `SELECT s.id, s.source, s.reason, s.inserted, s.updated, s.deleted, src.version, src.authority, src.license_verdict
       FROM snapshots s LEFT JOIN sources src ON src.id = s.source WHERE s.id = $1`,
      [snapshotId],
    )
  ).rows[0];
  if (!snap || snap.inserted + snap.updated + snap.deleted === 0) return null;

  const byCountry = (await db.query('SELECT country_code::text AS cc, count(*)::int AS n FROM changes WHERE snapshot_id = $1 GROUP BY 1 ORDER BY 2 DESC, 1', [snapshotId])).rows as { cc: string | null; n: number }[];
  const byKind = (await db.query('SELECT kind, op, count(*)::int AS n FROM changes WHERE snapshot_id = $1 GROUP BY 1, 2 ORDER BY 1, 2', [snapshotId])).rows as { kind: string; op: string; n: number }[];
  const fields = (await db.query('SELECT f, count(*)::int AS n FROM changes c, unnest(c.changed_fields) f WHERE c.snapshot_id = $1 AND c.op = \'update\' GROUP BY 1 ORDER BY 2 DESC LIMIT 6', [snapshotId])).rows as { f: string; n: number }[];
  const sample = async (op: 'insert' | 'delete') =>
    (await db.query(`SELECT coalesce(c.after->>'name', c.before->>'name', c.entity_id) AS name, c.country_code::text AS cc FROM changes c WHERE c.snapshot_id = $1 AND c.op = $2 ORDER BY c.seq LIMIT 5`, [snapshotId, op])).rows as { name: string; cc: string | null }[];
  const [added, removed] = [await sample('insert'), await sample('delete')];

  const vintage = snap.reason?.startsWith('vintage_change') ? snap.reason.replace('vintage_change: ', '') : null;
  const title = `${snap.authority ?? snap.source}: ${vintage ? `new release ${vintage}` : 'update'} (+${snap.inserted} ~${snap.updated} -${snap.deleted})`;
  const list = (r: { name: string; cc: string | null }[]) => r.map((x) => `${x.name}${x.cc ? ` (${x.cc})` : ''}`).join(', ');
  const body = [
    `# ${title}`,
    '',
    `Source: \`${snap.source}\`${snap.version ? ` · version ${snap.version}` : ''} · snapshot ${snapshotId}`,
    vintage ? `\n**New release (vintage change): ${vintage}.** Large structural changes are expected.` : '',
    '',
    `Records: ${snap.inserted} added, ${snap.updated} changed, ${snap.deleted} removed.`,
    '',
    '## By type',
    ...byKind.map((k) => `- ${k.kind} ${k.op}: ${k.n}`),
    fields.length ? `\n## Most changed fields\n${fields.map((f) => `- ${f.f}: ${f.n}`).join('\n')}` : '',
    '\n## By country',
    ...byCountry.slice(0, 15).map((c) => `- ${c.cc ?? '—'}: ${c.n}`),
    byCountry.length > 15 ? `- … and ${byCountry.length - 15} more` : '',
    added.length ? `\n## Added (examples)\n${list(added)}` : '',
    removed.length ? `\n## Removed (examples)\n${list(removed)}` : '',
    extra.detail ? `\n_Note: ${extra.detail}_` : '',
    '\nFetch the full change set from `GET /v1/changes` or the delta file of this snapshot.',
  ].filter((l) => l !== '').join('\n');

  const total = snap.inserted + snap.updated + snap.deleted;
  const isPublic = snap.license_verdict === 'green' || snap.license_verdict === 'amber';
  const countries = Object.fromEntries(byCountry.filter((c) => c.cc).map((c) => [c.cc!, c.n]));
  const r = await db.query(
    `INSERT INTO release_notes (snapshot_id, source_id, vintage, reason, title, body_md, totals, countries, public, highlight)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (snapshot_id) DO NOTHING RETURNING id`,
    [snapshotId, snap.source, snap.version ?? null, snap.reason ?? null, title, body, JSON.stringify({ inserted: snap.inserted, updated: snap.updated, deleted: snap.deleted }), JSON.stringify(countries), isPublic, !!vintage || snap.deleted > 0 || total >= 500],
  );
  if (!r.rowCount) return null;
  const id = Number(r.rows[0].id);
  if (isPublic) {
    await enqueueEvent(db, 'release.published', {
      release_id: id, snapshot_id: snapshotId, source_ids: [snap.source], vintage: snap.version ?? null, reason: snap.reason ?? null, title,
      totals: { inserted: snap.inserted, updated: snap.updated, deleted: snap.deleted }, changes_by_country: countries, release_url: `/v1/releases/${id}`,
    }, { snapshotId, countries: Object.keys(countries) });
  }
  return id;
}

export interface AttributeDiff {
  source: string;
  authority: string;
  verdict: string | null;
  vintageFrom: string | null;
  vintageTo: string;
  /** Country → attribute groups whose content changed (added, changed or removed). */
  changed: Record<string, string[]>;
  localeChanges: number;
}

/** Release note for a change in the CLDR-derived country attributes (no snapshot: these are not part of the change feed). */
export async function createAttributeReleaseNote(db: pg.Pool, d: AttributeDiff): Promise<number | null> {
  const countries = Object.keys(d.changed).sort();
  if (countries.length === 0 && d.localeChanges === 0) return null;
  const vintage = d.vintageFrom !== null && d.vintageFrom !== d.vintageTo;
  const groups: Record<string, number> = {};
  for (const g of Object.values(d.changed).flat()) groups[g] = (groups[g] ?? 0) + 1;
  const title = `${d.authority.split(' – ')[0]}: country attributes ${vintage ? `updated to ${d.vintageTo}` : 'changed'} (${countries.length} countries)`;
  const body = [
    `# ${title}`,
    '',
    `Source: \`${d.source}\` · ${vintage ? `${d.vintageFrom} → ${d.vintageTo}` : d.vintageTo}`,
    vintage ? `\n**New release (vintage change).** Formats and conventions (currency, date/time, week, measurement, units, locale) may differ.` : '',
    '',
    '## Attribute groups changed (countries)',
    ...Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([g, n]) => `- ${g}: ${n}`),
    d.localeChanges ? `\n${d.localeChanges} locale format sets changed (date, time and number patterns).` : '',
    '\n## Countries',
    countries.slice(0, 40).join(', ') + (countries.length > 40 ? `, … and ${countries.length - 40} more` : ''),
    '\nRead the current values with `GET /v1/profile` (scopes currency, datetime, numbers, measurement, locale); these attributes are not part of `GET /v1/changes`.',
  ].filter((l) => l !== '').join('\n');
  const isPublic = d.verdict === 'green' || d.verdict === 'amber';
  const cmap = Object.fromEntries(countries.map((c) => [c, d.changed[c]!.length]));
  const r = await db.query(
    `INSERT INTO release_notes (snapshot_id, kind, source_id, vintage, reason, title, body_md, totals, countries, public, highlight)
     VALUES (NULL, 'attributes', $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [d.source, d.vintageTo, vintage ? `vintage_change: ${d.vintageTo}` : null, title, body, JSON.stringify({ inserted: 0, updated: countries.length, deleted: 0 }), JSON.stringify(cmap), isPublic, vintage],
  );
  const id = Number(r.rows[0].id);
  if (isPublic) {
    await enqueueEvent(db, 'release.published', { release_id: id, snapshot_id: null, kind: 'attributes', source_ids: [d.source], vintage: d.vintageTo, reason: vintage ? `vintage_change: ${d.vintageTo}` : null, title, totals: { inserted: 0, updated: countries.length, deleted: 0 }, changes_by_country: cmap, release_url: `/v1/releases/${id}` }, { countries });
  }
  return id;
}

/** Mark a release as withdrawn (bad data was published) and tell subscribers. */
export async function retractRelease(db: pg.Pool, id: number): Promise<boolean> {
  const r = await db.query('UPDATE release_notes SET retracted = true WHERE id = $1 AND NOT retracted RETURNING snapshot_id, public, source_id, countries', [id]);
  if (!r.rowCount) return false;
  const n = r.rows[0];
  if (n.public) await enqueueEvent(db, 'release.retracted', { release_id: id, snapshot_id: Number(n.snapshot_id), source_ids: [n.source_id], release_url: `/v1/releases/${id}` }, { snapshotId: Number(n.snapshot_id), countries: Object.keys(n.countries) });
  return true;
}

export type Mailer = (to: string, subject: string, text: string) => Promise<void>;

/** Generic JSON-over-HTTPS mailer (`MAIL_WEBHOOK_URL`): POST {from,to,subject,text}. Adapt a provider behind that URL. */
export function webhookMailer(url: string, from: string, send: typeof fetch = fetch): Mailer {
  return async (to, subject, text) => {
    const res = await send(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from, to, subject, text }), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`mail HTTP ${res.status}`);
  };
}

const WEEK = 7 * 24 * 3600 * 1000;

/**
 * Send new public release notes to subscribers. `instant` subscribers get every new note; `weekly` ones a digest at most
 * once a week — unless a note is a highlight (vintage change, removals, large change), which goes out right away.
 * A subscriber's cursor only moves after the mail was accepted.
 */
export async function runDigest(db: pg.Pool, mail: Mailer, now = () => new Date()): Promise<number> {
  const subs = (await db.query('SELECT id, email, frequency, last_sent_note_id, last_sent_at FROM release_subscribers WHERE active ORDER BY id')).rows;
  let sent = 0;
  for (const s of subs) {
    const notes = (await db.query('SELECT id, title, body_md, highlight FROM release_notes WHERE public AND NOT retracted AND id > $1 ORDER BY id', [s.last_sent_note_id])).rows;
    if (notes.length === 0) continue;
    const due = s.frequency === 'instant' || notes.some((n) => n.highlight) || !s.last_sent_at || now().getTime() - new Date(s.last_sent_at).getTime() >= WEEK;
    if (!due) continue;
    const subject = notes.length === 1 ? notes[0].title : `country-info: ${notes.length} data updates`;
    const text = notes.map((n) => n.body_md).join('\n\n---\n\n') + '\n\n—\nYou receive this because this address is subscribed to country-info release notes.';
    try {
      await mail(s.email, subject, text);
    } catch (e) {
      console.error('digest mail failed for', s.email, (e as Error).message);
      continue;
    }
    await db.query('UPDATE release_subscribers SET last_sent_note_id = $2, last_sent_at = $3 WHERE id = $1', [s.id, notes[notes.length - 1].id, now()]);
    sent++;
  }
  return sent;
}
