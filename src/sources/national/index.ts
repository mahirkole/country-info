import type { NationalSource } from './types.js';
import { US } from './us.js';
import { FR } from './fr.js';
import { IT } from './it.js';
import { NL } from './nl.js';
import { NO } from './no.js';
import { SE } from './se.js';
import { CZ } from './cz.js';

/**
 * One adapter per country, each reading that country's own official data.
 * To add a country: read the publisher's license first (docs/LICENSES.md), write
 * `src/sources/national/<cc>.ts` exporting a NationalSource, register it here, add a test.
 */
export const NATIONAL: Record<string, NationalSource> = { US, FR, IT, NL, NO, SE, CZ };

export class LicenseNotEstablished extends Error {}

export function nationalSource(cc: string): NationalSource {
  const s = NATIONAL[cc.toUpperCase()];
  if (!s) throw new Error(`no national source registered for ${cc}`);
  if (s.licenseStatus === 'unread') throw new LicenseNotEstablished(`${cc}: license not established; refusing to ingest`);
  return s;
}
