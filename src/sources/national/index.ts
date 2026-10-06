import type { NationalSource } from './types.js';
import { US } from './us.js';
import { FR } from './fr.js';
import { IT } from './it.js';
import { NL } from './nl.js';
import { NO } from './no.js';
import { SE } from './se.js';
import { CZ } from './cz.js';
import { DE } from './de.js';
import { AT } from './at.js';
import { CA } from './ca.js';
import { AU } from './au.js';
import { CH } from './ch.js';
import { GB } from './gb.js';
import { ES } from './es.js';
import { PT } from './pt.js';
import { JP } from './jp.js';
import { PL } from './pl.js';
import { LV } from './lv.js';
import { SI } from './si.js';
import { HU } from './hu.js';
import { GR } from './gr.js';
import { LU } from './lu.js';
import { EE } from './ee.js';

/**
 * One adapter per country, each reading that country's own official data.
 * To add a country: read the publisher's license first (docs/LICENSES.md), write
 * `src/sources/national/<cc>.ts` exporting a NationalSource, register it here, add a test.
 */
export const NATIONAL: Record<string, NationalSource> = { US, FR, IT, NL, NO, SE, CZ, DE, AT, CA, CH, AU, GB, ES, PT, JP, PL, LV, SI, HU, GR, LU, EE };

export class LicenseNotEstablished extends Error {}

export function nationalSource(cc: string): NationalSource {
  const s = NATIONAL[cc.toUpperCase()];
  if (!s) throw new Error(`no national source registered for ${cc}`);
  if (s.licenseStatus === 'unread') throw new LicenseNotEstablished(`${cc}: license not established; refusing to ingest`);
  return s;
}
