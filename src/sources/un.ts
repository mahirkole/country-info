/** UN member states (193), ISO 3166-1 alpha-2. */
export const UN_MEMBERS = new Set(
  ('AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD ' +
    'CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ ' +
    'IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM ' +
    'NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ' +
    'ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VE VN YE ZM ZW').split(' '),
);

/** Non-member observer states. */
export const UN_OBSERVERS = new Set(['VA', 'PS']);

export type UnStatus = 'member' | 'observer' | 'other';

/** `other` = ISO 3166-1 area that is not a UN member/observer (dependency, territory, disputed). */
export function unStatus(iso2: string): UnStatus {
  if (UN_MEMBERS.has(iso2)) return 'member';
  if (UN_OBSERVERS.has(iso2)) return 'observer';
  return 'other';
}
