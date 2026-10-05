# Resmi tatil kaynakları – durum (son güncelleme: 2026-10-04)

**Politika:** `verified` = atıf yapılan resmi metnin **güncel konsolide sürümü** bu çalışmada okundu ve alıntı kaynak sayfada bağımsız olarak bulundu (`source.checked_on`, `source.url` dolu). Eski tarihli metin, hafızadan gelen tanım veya resmi olmayan sitede okunan metin `unverified`'dır. Ayrıntılı okuma notları ve alıntılar: `docs/sources/holidays/<CC>.md` (ajan notları; esas olan `data/holidays/<CC>.json`).

Sayılar 2026 yılı için kural sayısı (doğrulanmış/toplam).

| Ülke | Doğrulanan | Okunan resmi kaynak / neden doğrulanmadı |
|---|---|---|
| AT | 13/13 | RIS, Arbeitsruhegesetz § 7 Abs. 2 |
| CZ | 13/13 | zakonyprolidi.cz, Zákon 245/2000 Sb. § 1–2 (konsolide 13.05.2026) |
| EE | 12/12 | Riigi Teataja, Pühade ja tähtpäevade seadus (RT I, 20.12.2022). Paskalya kaymaları isimden türetildi. |
| ES | 4/4 | BOE, Estatuto de los Trabajadores art. 37.2 (yalnızca yasanın sabitlediği 4 ulusal gün; **kalan günler yıllık BOE kararı → eksik**) |
| HR | 14/14 | Narodne novine 110/2019, čl. 1. Corpus Christi ve Paskalya ofsetleri yasada yazmıyor, hesaplanıyor. |
| HU | 11/11 | net.jogtar.hu, Mt. 102. § (1), 2026.10.1 sürümü |
| IE | 9/9 | Organisation of Working Time Act 1997, 2. Çizelge (revised, Act 1/2025'e kadar). **St Brigid's Day (Şubat ilk Pazartesisi; 1 Şubat Cuma'ya denk gelirse o gün) eksik** – motor koşullu kural desteklemiyor, revised metinde de bulunamadı. |
| LV | 14/14 | likumi.lv, "Par svētku, atceres un atzīmējamām dienām" 1. p. (18.03.2025 sürümü). 4 Mayıs/18 Kasım hafta sonu → Pazartesi devri modellenmedi. |
| PL | 14/14 | Sejm ELI API, Dz.U. 2025 poz. 296 + değişiklikler (6 Ocak 2011'den, 24 Aralık 2025'ten). isap.sejm.gov.pl 403 verdi. |
| SE | 13/13 | riksdagen.se, Lag (1989:253) 1–2 §. Okunan kopya SFS 2004:1320'ye kadar işlenmiş; sonraki değişiklikler ayrıca kontrol edilmedi. Midsommarafton/Julafton/Nyårsafton yasada yok. |
| SK | 18/19 | slov-lex.sk, 241/1993 (01.11.2025 sürümü), **§ 4b: 2026'da 8 Mayıs ve 15 Eylül dinlenme günü değil** (Nager.Date burada yanlış). 1 Eylül, 28 Ekim, 17 Kasım yalnızca devlet bayramı (`observance`). 17 Kasım'ın 2024'e kadarki durumu okunmadı (`unverified`). |
| DK | 10/11 | Lov nr. 214/2023 § 7 listesi (retsinformation PDF). Birincil helligdag hükmü bulunamadı. Store Bededag (2023'e kadar) tanımı hafızadan → `unverified`. |
| PT | 13/17 | Diário da República, Lei 8/2016 (art. 234 n.º 1). 2013 öncesi 4 kural `unverified`. |
| DE | 1/9 | Yalnızca Einigungsvertrag Art. 2(2) (3 Ekim) okundu; diğerleri eyalet yasaları. **Bölgesel tatiller eksik.** |
| IT | 6/11 | DPR 792/1985 art. 1 (dini günler) okundu; Legge 260/1949 metni sayfadan çıkarılamadı. 4 Ekim durumu doğrulanmadı. |
| TR | 17/17 (dini bayramlar Diyanet'ten otomatik; yayımlanmamış yıllar için kayıt yok) | 2026-10-05: 2429 sayılı Kanun (mevzuat.gov.tr) ve Diyanet Dini Günler tabloları okundu (bkz. `TR.md`). |
| BE | 0/10 | ejustice.just.fgov.be WAF engeli; hafızadan. |
| LU | 0/11 | legilux JS-only; hafızadan. |
| FI | 0/13 | Kirkkolaki (652/2023) kilise bayramlarını sayıyor; sivil tatil dayanağı okunmadı. |
| GR | 0/9 | Yasa 4808/2021 art. 60 yalnızca resmi olmayan sitede okundu. **Temiz Pazartesi, Büyük Cuma, Paskalya, Pentekost Pazartesi eksik.** |
| LT | 0/14 | Darbo kodeksas m. 123'ün 2016 sürümü okundu; güncel konsolide sürüm yok. |
| MT | 0/14 | Cap. 252, 12.02.2021 tarihli sürüm; sonraki değişiklikler kontrol edilmedi. |
| SI | 0/15 | 2005 tarihli UPB1; pisrs.si yalnızca JS. |
| BG | 14 kural, hepsi `unverified` | Kodeks na truda md. 154(1) resmî sitelerden okunamadı (lex.bg 403, parliament.bg JS engeli); liste yalnızca ikincil özetten → `checked_on` yok. Notlar: docs/sources/holidays/BG.md |
| RO | 12 verified + 5 unverified | Codul muncii art. 139(1), Inspecția Muncii'nin konsolide PDF'inden okundu (**9–22 Mart 2023 formu**; sonraki değişiklikler legislatie.just.ro engelli olduğundan denetlenmedi); 15 Ağustos ve 25/26 Aralık takvim günleri metinde yok, Rusalii ofsetleri metinde yok → `unverified`; `from_year: 2023` güvenli alt sınır. Notlar: docs/sources/holidays/RO.md |
| CY | 1 verified + 14 unverified | Genel bir resmî tatil kanunu bulunamadı; 1 Nisan N. 121/1989 art. 2'den (verified). Diğerleri Banka Tatilleri Kanunu N. 13(I)/1996 art. 5'ten (banka tatilleri ≠ resmî tatil → `unverified`). Notlar: docs/sources/holidays/CY.md |
| FR | verified (17 kural) | Code du travail L3133-1 ve L3134-13 (Alsace-Moselle), code.travail.gouv.fr (Çalışma Bakanlığı) kopyasından okundu (Légifrance hâlâ 403); Paskalya ofsetleri adlardan türetildi; Cuma (Vendredi Saint) yalnız "temple protestant ou église mixte" olan komünlerde — motor komün düzeyini bilmediği için département bütününe uygulanır (aşırı kapsama, atıfta belirtildi). Notlar: docs/sources/holidays/FR.md |
| NL | 8 verified + Koningsdag tentative | Algemene termijnenwet art. 3 (wetten.overheid.nl/BWBR0002448) okundu; Goede Vrijdag yalnız "gelijkgesteld" (lid 2); Koningsdag tarihi kanunda yok — 27 Nisan/Pazar → 26 Nisan kuralı rijksoverheid sayfasından (2026–2027 verified, 2028–2040 tentative `listed`). Notlar: docs/sources/holidays/NL.md |

## Nager.Date alarmının bulguları (2026) — `npm run check:holidays 2026`
- **SK:** Nager 8 Mayıs ve 15 Eylül'ü tatil gösteriyor; birincil metin (§ 4b) 2026'da dinlenme günü olmadıklarını söylüyor. Resmi kaynak doğru, aggregator yanlış.
- Fiili ama yasal olmayan günler (BE Goede Vrijdag/Dag na Hemelvaart, DK Grundlovsdag/Juleaftensdag, SE/FI Julafton/Midsommarafton, LV anma günleri, SI anma günleri, PT Carnaval): bilerek dahil edilmedi.
- Gerçek boşluklar: ES (yıllık takvim), IE (St Brigid's), GR (hareketli Ortodoks günleri), IT (Pasqua Pazarı, 4 Ekim).
- AT/HU/IT: Paskalya/Pentekost **Pazarları** listede yok (zaten Pazar).
