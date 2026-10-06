# Ulusal resmi kaynaklar (ülke başına ayrı adaptör)

Yaklaşım: her ülkenin kendi resmi verisi, `src/sources/national/<cc>.ts` içinde ayrı adaptör; çıktı `division` kayıtları (`div:<CC>:<kod>`) ve ortak sözlük (`src/taxonomy.ts`: state, province, region, prefecture, canton, county, district, department, municipality, commune, borough, parish, ward, neighbourhood, street, other). Her kayıtta `data.level` (1 = ülkenin altındaki ilk seviye), `data.type` (ortak sözlük) ve `data.type_local` (yerel ad: "département", "Parish"…).

Yeni ülke eklerken sıra: (1) yayıncının lisans metnini oku → `docs/LICENSES.md`; (2) adaptör + test; (3) `NATIONAL` kaydına ekle; (4) bu tabloyu güncelle. `licenseStatus: 'unread'` olan kaynak yüklenmez.

## Durum (son kontrol: 2026-10-04, bu konteynerden)

| Ülke | Kaynak | Seviyeler | Erişim | Lisans | Durum |
|---|---|---|---|---|---|
| US | Census Bureau ANSI/FIPS codes 2020 | state, county (+parish, borough, independent city, municipio) | ✅ | partial (17 U.S.C. § 105; sayfada açık "public domain" ifadesi bulunamadı) | **Yüklü: 3.292 birim** |
| FR | INSEE Code officiel géographique 2026 (CSV; en yeni sayfa otomatik keşfedilir) | région, département, commune (+ arrondissement municipal, commune associée/déléguée) | ✅ | **read** (Licence Ouverte 2.0) | **Yüklü: 37.031** (18 / 101 / 34.875 / alt: 1.521 déléguée, 471 associée, 45 ARM) |
| CH | BFS Amtliches Gemeindeverzeichnis (REST snapshot `date=01-01-<yıl>`) | Kanton, Bezirk, Gemeinde | ✅ | 🟡 opendata.swiss "Open use" (ticari serbest, kaynak önerilir; yeniden dağıtım cümlesi yok) | **Yüklü: 2.280** (26 / 144 / 2.110) |
| IT | ISTAT Elenco dei comuni italiani (**xlsx**, güncel; CSV bayat) | region, province/UTS, comune (+ NUTS 2024) | ✅ | **read** (CC BY 4.0) | **Yüklü: 8.024** (20 / 110 / 7.894; 21.02.2026 durumu, Sardinya yeniden yapılanması delta olarak yakalandı) |
| JP | MIC/Soumu 全国地方公共団体コード (xlsx) | prefecture, municipality | ✅ | okunmadı | Sırada (xlsx ayrıştırıcı gerekir) |
| PL | GUS Bank Danych Lokalnych API (`data/by-variable/72305` ile güncel birimler) | województwo, powiat, gmina | ✅ | **read** 🟢 (GUS BDL sayfası: CC BY 4.0) | **Yüklü: 2.875** (16 / 380 / 2.479). `/units` listesi 1995'ten beri tarihsel birimleri de içerir (2.692 gmina) — kullanılmaz. Anonim kota 100 çağrı/15 dk (≈45 çağrı/çalıştırma; 429'da bekler) |
| LV | CSP ATVK 2021 (data.gov.lv CKAN, en yeni `ATVK_2021_<tarih>` CSV) | pašvaldība (42: 35 novads + 7 valstspilsēta), pilsēta/pagasts (586) | ✅ | **read** 🟢 (CSP politikası: CC BY 4.0; metaveri CC0) | **Yüklü: 628** (42 / 75 / 511) |
| SI | SURS SiStat PxWeb 2640010S (`OBČINE` değişkeni) | občina (212; üst bölge yok) | ✅ | **read** 🟢 (SURS telif sayfası: ticari dahil serbest, atıf) | **Yüklü: 212** |
| HU | KSH Helységnévtár xlsx (tarayıcı benzeri başlıklar gerekir) | vármegye (19), település (3.155), Budapeşte kerületleri (23) | ✅ | **read** 🟢 (KSH: CC BY 4.0) | **Yüklü: 3.197** (19+1 / 3.155 / 23; dosya 2025-01-01 durumunda) |
| GR | ELSTAT Μητρώο Οικισμών (xls; sayfadan kazınan indirme bağlantısı) | περιφέρεια (13), περιφερειακή ενότητα (75), δήμος (333 incl. Άγιο Όρος) | ✅ | **read** 🟢 (ELSTAT yeniden kullanım politikası: ticari dahil serbest, kaynak + değişiklik belirtilir) | **Yüklü: 421** (13 / 75 / 333); yeni `src/sources/xls.ts` BIFF8 okuyucu |
| NL | CBS StatLine 86247NED "Gebieden in Nederland 2026" | landsdeel, provincie, gemeente | ✅ (Node istemcisi 406 alıyor, curl yedeği kullanılıyor) | partial (CBS web sitesi CC BY 4.0; OData tablosuna ayrı lisans metni bulunamadı) | **Yüklü: 358 birim** (4 / 12 / 342) |
| NO | Kartverket kommuneinfo (api.kartverket.no) | fylke, kommune | ✅ | **read** (CC BY 4.0 veri seti kayıtları; API kaydı "Arkivert") | **Yüklü: 372** (15 / 357) |
| SE | SCB PxWebApi v2 (yıllık tablo otomatik keşfedilir) | län, kommun | ✅ | **read** (CC0) | **Yüklü: 311** (21 / 290), `TAB6646` |
| GB | ONS Open Geography (ArcGIS REST; en yeni vintage arama ile bulunur) | nation, region (yalnız İngiltere), local authority district (county/UA öznitelik) | ✅ | partial 🟡 OGL v3 (dossier) | **Yüklü: 374** (4 / 9 / 361); posta kodu/UPRN alınmaz; atıf "Source: Office for National Statistics licensed under the Open Government Licence v.3.0" |
| AU | ABS ASGS | state, SA4…SA1 | ✅ | 🟢 yapılar CC BY 4.0 / 🟡 LGA | Sırada (Edition 4) |
| ES | INE diccionario YY.xlsx (belediye) + INEbase Tempus API (CCAA/il adları, değişken 70/115) | comunidad autónoma, provincia, municipio | ✅ | partial 🟡 (INE yeniden kullanım metni okundu 2026-10-05; belediye adlarının REL kaynaklı olması belirsiz, dossier) | **Yüklü: 8.203** (19 / 52 / 8.132 — resmî sayılarla aynı); atıf "Elaboración propia con datos extraídos del sitio web del INE: www.ine.es" |
| PT | DGT CAOP2025 OGC API (CSV) + Açores/Madeira GeoPackage (`node:sqlite`) | distrito/ilha, município, freguesia | ✅ | **read** 🟢 (CC BY 4.0; ada dosyaları için lisans kapsayıcı beyanla, dosya-bazlı metin yok) | **Yüklü: 3.596** (29 / 308 / 3.259) |
| JP | MIC 全国地方公共団体コード (xlsx; sayfadan en yeni dosya keşfi) | 都道府県, 市区町村, 区 (政令指定都市) | ✅ | partial 🟢 (MIC site telif metni okundu: 公共データ利用規約 v1.0, atıf + işlendi notu) | **Yüklü: 1.965** (47 / 1.747 / 171 — sayfa R6.1.1 durumu, Hamamatsu 2024 birleşmesi sonrası 171 ward) |
| DK | DAWA (`api.dataforsyningen.dk`) | region, municipality | ❌ 410 (adres değişmiş) | – | Yeni adres araştırılacak |
| CA | Statistics Canada | province, census division, subdivision | ❌ 403 | – | Başka erişim yolu |
| TR | TÜİK, NVİ (UAVT/MAKS) | il, ilçe, mahalle, sokak | ❌ | – | Kullanıcı ağı gerekir |
| EU27 | Eurostat GISCO NUTS/LAU | nuts1-3, lau | ✅ | read | **Yüklü** (`gisco-*`) |
| Diğer | – | – | – | – | Araştırılmadı |

| CZ | ČSÚ Struktura území ČR (CSV) | region soudržnosti (NUTS 2), kraj (NUTS 3), okres, obec | ✅ | **read** (CC BY 4.0) | **Yüklü: 6.357** (8 / 14 / 77 / 6.258) |
| DE | Destatis Gemeindeverzeichnis GV-ISys (`AuszugGV3QAktuell.xlsx`, çeyreklik; sabit "Aktuell" adı) | Land, Regierungsbezirk, Kreis, Gemeinde (+ koordinat, nüfus, alan) | ✅ | **read** (Destatis telif sayfası: ticari yeniden kullanım serbest, Quellennachweis) | **Yüklü: 11.386** (16 / 29 / 401 / 10.940; Gebietsstand 30.09.2026) |
| AT | STATISTIK AUSTRIA reglisten.zip (`polbezirke.csv`, `gemliste_knz.csv`) | Bundesland, politischer Bezirk, Gemeinde (+ Viyana Gemeindebezirke) | ✅ | **read** (CC BY 4.0 + AGB § 10; "bearbeitet" notu) | **Yüklü: 2.218** (9 / 94 / 2.092 / 23); posta kodu sütunları alınmaz |
| CA | Statistics Canada SGC 2021 structure (CSV) | region, province/territory, census division, census subdivision | ✅ | **read** (StatCan Open Licence; "Adapted from… not an endorsement" atfı) | **Yüklü: 5.473** (6 / 13 / 293 / 5.161) |
| AU | ABS ASGS Edition 4 (SA2 allocation xlsx) | State/Territory, SA4, SA3, SA2 (GCCSA öznitelik; LGA alınmaz) | ✅ | **read** (ABS site CC BY 4.0; istisnalar logo/arma/mikrodata/3. taraf) | **Yüklü: 3.056** (10 / 108 / 367 / 2.571) |

## Dossier sonrası ek adaylar (lisans 🟢, ayrıntı `docs/licenses/README.md`)
FI (Tilastokeskus sınıflandırma API'si, 308 belediye — **kunta→maakunta eşleme servisi 500 veriyor, hiyerarşi için beklemede**), CZ yüklendi. 🟡: DK, PL, NL (zaten yüklü). ⚪: BE (CAPTCHA).

## Wikidata bölünme katmanı (topluluk, CC0 — resmi kaynağı kapalı/okunamayan ülkeler)
Motor: `src/sources/wikidata-divisions.ts`, ülke yapılandırması `src/sources/wikidata-countries.ts` (kaynak kimliği `wd-<cc>`, `source_class=community`, aylık `refresh`). Her seviye için Wikidata sınıfı + **resmi sayı bandı**; band dışı seviye yüklenmez. Sınıflar GeoNames'in bağladığı öğelerin `P31` değerlerinden veya adı bilinen belediyelerden **veriyle** doğrulandı (hafızadaki QID'ler bir kez yanlış çıktı: Q2039348 = Hollanda belediyesi). Üst birim = önceki seviyelerdeki `P131` atası (en derin seviye kazanır); atasız öğe atlanır (>%1 ise hata).
| CC | Seviyeler | Yüklü |
|---|---|---|
| DK | region (5; "Region Østdanmark" dışlandı), kommune (98) | 103 |
| FI | maakunta (19), kunta (308) | 327 |
| BE | gewest (3), provincie (10), gemeente (564; Bergen/Mons Q83407 atasız → atlandı) | 577 |
| BR | unidade federativa (27), município (5.572; band 5.565–5.575, resmi 5.570 + DF) | 5.599 |
| IN | state / union territory (28+8 = 36); ilçeler yüklenmez (Wikidata 798, doğrulayacak açık resmi sayı yok) | 36 |
| BG | obshtina (265) | 265 |
| SK | kraj (8), obec (Wikidata 2.888; resmî 2.890, ŠÚ SR om7023rr; band 2.880–2.895; okresy yüklenmez: Wikidata 82 ≠ 79) | 2.896 |
| LU | canton (12), commune (100) | 112 |
| EE | maakond (15), vald/linn (78) | 93 |
| IE | local authority (31) | 31 |
| SK (resmî) | kraj (8), okres (79), obec/mesto/mestská časť/vojenský obvod (2.928) | 3.015 — Register adries (nat-sk, CC0); aşağıdaki Wikidata SK satırı topluluk çapraz referansı olarak kalır, resmî katman önceliklidir |
| CY | επαρχία (6), δήμος/κοινότητα (613) | 619 |
| DK | region (5), landsdel (11), kommune (99) | 115 |
| FI | maakunta (19), kunta (308) | 327 |
| LT | savivaldybė (60 = 43 apskrities + 7 miesto + 10 diğer; resmî 60); apskritys yüklenmez | 60 |
| EE | maakond (15), vald/linn (78; Statistikaamet EHAK 78, 2025'te 79; band 78–79) | 93 |
| RO | județ (41), comună/oraș/municipiu (3.178; band 3.170–3.190 = Eurostat LAU sayısı 3.181 — INS erişilemedi, resmî sayı okunamadı; București atlandı: il üst birimi yok) | 3.219 |
Yüklenmeyenler (2026-10-05 keşif: sınıf bulundu ama sayı resmiyle uymuyor / sınıf bulunamadı): SI (203≠212), SK (2.902 vs ≈2.927), GR (333 vs 332), HR (432 belediye + şehirler ayrı sınıf), RO (108), CY (43), MT (18 yerel konsey), LT (43 ilçe belediyesi, hepsi değil); EE, HU, IE, LU, LV, PL: sınıf bulunamadı. PL (voivodeship 16 ✓; powiat Wikidata'da 320+67 ≠ resmi 380; gmina sınıfı doğrulanmadı), KR (üst birimler 6 sınıfa dağılmış; 17'lik resmi yapı için sınıf eşlemesi gerekir), TR (il 81 ✓ ama GeoNames zaten kapsıyor; ilçe 1.052≠973).

## AB27 LAU boşluğu — araştırma sonuçları (2026-10-05, alt-ajan raporları + üretici doğrulaması)
- **Yüklendi:** LV, SI, HU, GR (yukarıdaki tablo), PL.
- **EE:** resmî Statistikaamet EHAK sınıflandırması yayıncı beyanıyla **CC BY-SA 4.0** (ShareAlike) → satış paketine uygunluğu hukuki karar, resmî kaynak yüklenmedi; Wikidata katmanı yüklendi (sayı kapısı EHAK'ın 78'ine göre).
- **LU:** resmî kaynak **nat-lu** (STATEC LAU kodları XLSX, data.public.lu CC0; 12 kanton + 100 komün, dosyanın kendi sayım beyanıyla uyumlu; docs/licenses/nat-lu.md) — 2026-10-06'da eklendi; Wikidata katmanı (`wd-lu`) öncelik kuralıyla ikinci sırada kalır.
- **IE:** CSO PxStat (31 yerel yönetim, CC BY 4.0 yayıncı beyanı) ama resmi kısa kod/üst birim yok → yüklenmedi.
- **CY:** CYSTAT LAU2 listesi 615 kayıt, 2024 reformu öncesi; lisans yalnız portal meta verisi → yüklenmedi.
- **LT, MT:** resmî siteler konteynerden erişilemedi; LT Wikidata katmanıyla yüklendi (60), MT yüklenmedi.
- **GR: yüklendi (yukarıda)** — xls okuyucu (`cfb` + BIFF8) yazıldı.
- **SK:** ŠÚ SR data.statistics.sk JSON-stat API, CC BY 4.0 (yayıncı sayfası); **engeller:** DATAcube 15 Eylül 2026'da kapatılmış (yeni STATdata uçları bulunamadı), resmî sayı (2.890) veriyle uzlaşmıyor (2.885 belediye + 39 şehir parçası + 4 askerî bölge) → yüklenmedi.
- **HR:** MPUDT listesi (428 općina + 127 grad + Zagreb, 20 županija; "yeniden kullanım atıfla serbest") **resmî kod içermiyor**, dosya 2013 tarihli xls → yüklenmedi (sentetik kimlik istemiyoruz).
- **RO:** insse.ro/data.gov.ro erişilemedi (resmî kaynak `unread`); Wikidata katmanı yüklendi (topluluk, band Eurostat sayısına göre).
- **SK:** resmî API kapandığı için Wikidata katmanı (kraj + obec) yüklendi.
- Wikidata'dan geçmeyenler (2026-10-05 sınıf/sayı keşfi): SI (202+12 city = 214 ≠ 212), HR (432 općina + 244 şehir sınıfı ≠ 555), CY (8 ≠ 6 ilçe), IE (31 county sınıfı, 26+5 yerel yönetim; LAU eşleniği yok), MT (sınıf dağınık: yerel konsey sınıfı 15/68).

## Tasarım notları
- GeoNames (`geonames`) hâlâ dünya geneli taban katman; ulusal kaynaklar `division` olarak **yanına** eklenir, GeoNames'i silmez. "Yalnızca resmi" mod için bkz. `docs/ROADMAP.md`.
- Ülkelerin düzey adları farklıdır: `type` ortak sözlükten seçilir, yerel ad `type_local`'e gider; karşılığı olmayan kavram için önce sözlüğe tür eklenir.
- Mahalle/sokak gibi alt seviyeler (TR NVİ, ülke adres kayıtları) aynı modelle eklenebilir (`level` 4, 5…, `type: neighbourhood|street`); hacim ve KVKK/GDPR nedeniyle ayrıca değerlendirilir.

## OCHA COD-AB (çok ülkeli, resmî üst kaynaklı; `cod-ab`)
Ulusal adaptörü olmayan ve HDX COD-AB'nin üst kaynağı ulusal bir kurum (istatistik/haritalama/planlama/seçim sınır otoritesi) olan ülkeler için `division` katmanı (üst veri sahibinin lisansı kanıtlı 5 ülke: MX SK CL CO TN, 4.442 birim; `docs/licenses/cod-upstream.md`). Ülke seçimi: otomatik ret filtresi + `cod:ack` incelemesi (docs/PROGRESS.md "Faz 12"); lisans: `docs/licenses/ocha-cod-ab.md` (CC BY 3.0 IGO, 🟡). Ulusal adaptör sonradan eklenen ülke otomatik olarak COD'dan çıkar (ulusal kaynak önceliklidir; `NATIONAL` anahtarları atlanır). BE CY DK FI HR IE LT MT COD-AB'de yok.
