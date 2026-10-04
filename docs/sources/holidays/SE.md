> **Not:** Bu dosya bir ajanın okuma notudur (2026-10-04). Depodaki `data/holidays/SE.json` esas alınır; orada `verification` durumu bu notlardan farklı olabilir (güncel olmayan metin sürümü veya hafızadan gelen tanım tespit edilenler `unverified`'a indirildi).

# SE evidence (checked 2026-10-04)
Sources read: https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1989253-om-allmanna-helgdagar_sfs-1989-253/ (same text also at https://data.riksdagen.se/dokument/sfs-1989-253.text). Text header says "Ändrad: t.o.m. SFS 2004:1320" (latest amendment shown).
- 1 § (URL above): "nyårsdagen, trettondedag jul, första maj, juldagen och annandag jul, även när de inte infaller på en söndag," -> new-years-day, epiphany, labour-day, christmas-day, boxing-day
- 1 § : "långfredagen, annandag påsk, Kristi himmelsfärdsdag, nationaldagen, midsommardagen och alla helgons dag."
- 1 §: "söndagar, däribland påskdagen och pingstdagen," -> easter-sunday, whit-sunday
- 2 §: "nyårsdagen den 1 januari", "trettondedag jul den 6 januari", "nationaldagen den 6 juni", "juldagen den 25 december", "annandag jul den 26 december" (first of May: only named in 1 §; date implied)
- 2 §: "långfredagen fredagen närmast före påskdagen"; "annandag påsk dagen efter påskdagen" ; "Kristi himmelsfärdsdag sjätte torsdagen efter påskdagen" (= Easter+39); "pingstdagen sjunde söndagen efter påskdagen" (= Easter+49)
## Not included
- Midsommardagen: "den lördag som infaller under tiden den 20-26 juni" (not expressible).
- Alla helgons dag: "den lördag som infaller under tiden den 31 oktober-6 november" (not expressible).
- Midsommarafton, julafton, nyårsafton: NOT mentioned in the Act at all (de facto days off only). Other Sundays are holidays by 1 §.
## Could not read
- Nothing; note amendment list ends 2004:1320 in the copy read, later amendments (if any) not checked. Easter date definition (full-moon rule) in 2 § not encoded; engine computes gregorian Easter.
