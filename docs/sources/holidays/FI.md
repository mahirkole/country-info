> **Not:** Bu dosya bir ajanın okuma notudur (2026-10-04). Depodaki `data/holidays/FI.json` esas alınır; orada `verification` durumu bu notlardan farklı olabilir (güncel olmayan metin sürümü veya hafızadan gelen tanım tespit edilenler `unverified`'a indirildi).

# FI evidence (checked 2026-10-04)
Source read: https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act/statute-consolidated/2023/652/fin@ (Kirkkolaki 652/2023, consolidated, official Finlex open-data API).
- 1 luku 6 § Kirkolliset juhlapäivät: "Kirkollisia juhlapäiviä ovat joulupäivä, toinen joulupäivä, uudenvuodenpäivä, loppiainen, pitkäperjantai, pääsiäispäivä, toinen pääsiäispäivä, helatorstai, helluntai, juhannuspäivä ja pyhäinpäivä."
- This establishes CHURCH holidays in Church Act; I did not read a civil statute declaring them public holidays, so all FI rules are marked unverified (the text itself was read for the 9 fixed/Easter-based church days).
## Not included
- Juhannuspäivä (Saturday 20-26 June) and pyhäinpäivä (Saturday 31 Oct-6 Nov): floating, not expressible. Juhannusaatto, jouluaatto: not read; not included.
## Could not read
- Could not locate the civil act ("Laki kirkollisista juhlapäivistä 1868/1922" was not found: 1922/236 is an unrelated tariff decision on Finlex; no 1922 act with juhlapäivä in title in the open-data API). Vappu (1 May) and Itsenäisyyspäivä (6 Dec) statutory basis not read -> unverified, no source URL. Finlex UI is JS-rendered; open-data API used.
