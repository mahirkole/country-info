import type { EntityInput } from '../model.js';

export interface Diff {
  onlyOurs: string[];
  onlyTheirs: { date: string; name: string }[];
}

/**
 * Compare our nationwide public holidays with an external list (e.g. Nager.Date).
 * The external list is only an alarm: a difference means "look at the official source", never "copy theirs".
 */
export function diffHolidays(ours: EntityInput[], theirs: { date: string; name: string }[]): Diff {
  const mine = new Set(ours.filter((h) => h.data.type === 'public' && h.parent_id === `country:${h.country_code}`).map((h) => h.data.date as string));
  const other = new Map(theirs.map((t) => [t.date, t.name]));
  return {
    onlyOurs: [...mine].filter((d) => !other.has(d)).sort(),
    onlyTheirs: [...other].filter(([d]) => !mine.has(d)).map(([date, name]) => ({ date, name })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

interface NagerHoliday {
  date: string;
  localName: string;
  global: boolean;
  counties: string[] | null;
}

export async function fetchNager(country: string, year: number, send: typeof fetch = fetch): Promise<{ date: string; name: string }[]> {
  const res = await send(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
  if (!res.ok) throw new Error(`nager ${country} ${year}: ${res.status}`);
  return ((await res.json()) as NagerHoliday[]).filter((h) => h.global && !h.counties).map((h) => ({ date: h.date, name: h.localName }));
}
