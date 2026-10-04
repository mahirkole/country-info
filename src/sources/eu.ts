/** EU member states (ISO 3166-1 alpha-2). Note GISCO/Eurostat use `EL` for Greece. */
export const EU27 = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
] as const;

/** Eurostat country code -> ISO 3166-1 alpha-2. */
export const EUROSTAT_TO_ISO: Record<string, string> = { EL: 'GR', UK: 'GB' };
export const toIso = (c: string): string => EUROSTAT_TO_ISO[c] ?? c;
