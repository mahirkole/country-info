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
| NL | CBS StatLine 86247NED "Gebieden in Nederland 2026" | landsdeel, provincie, gemeente | ✅ (Node istemcisi 406 alıyor, curl yedeği kullanılıyor) | partial (CBS web sitesi CC BY 4.0; OData tablosuna ayrı lisans metni bulunamadı) | **Yüklü: 358 birim** (4 / 12 / 342) |
| NO | Kartverket kommuneinfo (api.kartverket.no) | fylke, kommune | ✅ | **read** (CC BY 4.0 veri seti kayıtları; API kaydı "Arkivert") | **Yüklü: 372** (15 / 357) |
| SE | SCB PxWebApi v2 (yıllık tablo otomatik keşfedilir) | län, kommun | ✅ | **read** (CC0) | **Yüklü: 311** (21 / 290), `TAB6646` |
| GB | ONS Open Geography (ArcGIS REST; en yeni vintage arama ile bulunur) | nation, region (yalnız İngiltere), local authority district (county/UA öznitelik) | ✅ | partial 🟡 OGL v3 (dossier) | **Yüklü: 374** (4 / 9 / 361); posta kodu/UPRN alınmaz; atıf "Source: Office for National Statistics licensed under the Open Government Licence v.3.0" |
| AU | ABS ASGS | state, SA4…SA1 | ✅ | 🟢 yapılar CC BY 4.0 / 🟡 LGA | Sırada (Edition 4) |
| ES | INE diccionario YY.xlsx (belediye) + INEbase Tempus API (CCAA/il adları, değişken 70/115) | comunidad autónoma, provincia, municipio | ✅ | partial 🟡 (INE yeniden kullanım metni okundu 2026-10-05; belediye adlarının REL kaynaklı olması belirsiz, dossier) | **Yüklü: 8.203** (19 / 52 / 8.132 — resmî sayılarla aynı); atıf "Elaboración propia con datos extraídos del sitio web del INE: www.ine.es" |
| PT | DGT CAOP2025 OGC API (CSV, geometrisiz) | distrito, município, freguesia (yalnız kıta) | ✅ | **read** 🟢 (CC BY 4.0; Açores/Madeira yok) | **Yüklü: 3.345** (18 / 278 / 3.049) |
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
FI (Tilastokeskus sınıflandırma API'si, 308 belediye — **kunta→maakunta eşleme servisi 500 veriyor, hiyerarşi için beklemede**), PT Açores/Madeira (gpkg). CZ yüklendi. 🟡: DK, PL, NL (zaten yüklü). ⚪: BE (CAPTCHA).

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
Yüklenmeyenler (2026-10-05 keşif: sınıf bulundu ama sayı resmiyle uymuyor / sınıf bulunamadı): SI (203≠212), SK (2.902 vs ≈2.927), GR (333 vs 332), HR (432 belediye + şehirler ayrı sınıf), RO (108), CY (43), MT (18 yerel konsey), LT (43 ilçe belediyesi, hepsi değil); EE, HU, IE, LU, LV, PL: sınıf bulunamadı. PL (voivodeship 16 ✓; powiat Wikidata'da 320+67 ≠ resmi 380; gmina sınıfı doğrulanmadı), KR (üst birimler 6 sınıfa dağılmış; 17'lik resmi yapı için sınıf eşlemesi gerekir), TR (il 81 ✓ ama GeoNames zaten kapsıyor; ilçe 1.052≠973).

## Tasarım notları
- GeoNames (`geonames`) hâlâ dünya geneli taban katman; ulusal kaynaklar `division` olarak **yanına** eklenir, GeoNames'i silmez. "Yalnızca resmi" mod için bkz. `docs/ROADMAP.md`.
- Ülkelerin düzey adları farklıdır: `type` ortak sözlükten seçilir, yerel ad `type_local`'e gider; karşılığı olmayan kavram için önce sözlüğe tür eklenir.
- Mahalle/sokak gibi alt seviyeler (TR NVİ, ülke adres kayıtları) aynı modelle eklenebilir (`level` 4, 5…, `type: neighbourhood|street`); hacim ve KVKK/GDPR nedeniyle ayrıca değerlendirilir.
