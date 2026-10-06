# Yol haritası ve kalan işler (sonraki oturumlar için)

Son güncelleme: 2026-10-05 (Faz 6 planı en altta; özet kayıt: docs/PROGRESS.md). Dal: `claude/country-info-mvp` (PR açılmadı). Her maddeyi bitirince burayı güncelleyin.

## Tamamlandı
- MVP: GeoNames ülke/admin1/admin2 ingest, snapshot/delta/webhook, dosya dışa aktarım.
- Çok kaynaklı ingest + provenance (`sources`, `source_id`), kaynaklar birbirini silmez, silme koruması (%5).
- Eurostat GISCO: NUTS (AB27 + TR İBBS = 1.620) ve LAU (AB27 ≈ 95k).
- Tatil kural motoru (sabit, Paskalya, n. hafta günü, `on_or_after`, listeli; `if_weekday` koşullu kural, `substitute` hafta sonu devri → `data.observed`, `hours` yarım gün saatleri — motor 2026-10-05'te genişledi, ülke dosyaları yalnızca resmî metin okunarak bu alanlara geçirilir) ve 23 ülke dosyası; doğrulama durumu `docs/sources/EU-holidays.md` (10 ülke tam doğrulanmış). Ajan okuma notları `docs/sources/holidays/`.
- GeoNames şehirleri (`cities15000`, 34.152 kayıt).
- GeoNames↔NUTS ad eşlemesi (770 admin1'den 169 bağ), `/v1/review-items`.
- Atıf: `sources.attribution`, `/v1/sources`, `ATTRIBUTION.md`; lisans okuma bulguları `docs/LICENSES.md`.

- Wikidata (CC0) zenginleştirme: `entity_xrefs`/`entity_names`, `npm run enrich:wikidata`, QID ile bağlama (`linkByQid`); `sources.source_class` (official|community) ve `?official_only=true`. Tam çalıştırma (2026-10-05): GeoNames 68.803/85.312 QID eşleşti, FR komün 33.401/34.875, DE 10.938/10.940, AT 2.091/2.092, IT 7.628/7.894, CH 2.074/2.110; ~616k+ çok dilli ad; `link` sonrası QID ile 1.169 bağ (ad eşlemesi 169'du). Belirsizler (ör. FR 1.474) `value=NULL` kalır, tahmin edilmez. Wikidata bölünme motoru (`wikidata-divisions.ts`, sayı kapılı) DK/FI/BE için yüklü (docs/sources/NATIONAL.md). **Kalan:** `source_priority` kuralları, TR/IN/KR/BR/BE/DK/FI/PL için altın-sayı kapılı Wikidata bölünme katmanı (TR ilçe 1.039≠973 → kullanılmaz), LAU'yu ulusal kaynaklarla değiştirip `gisco-lau`'yu kaldırma, CLDR ile M49/dil/para birimi, JP/PT/GB/ES adaptörleri.

- CLDR (Unicode License v3) alt kümesi: `npm run enrich:cldr` ülke adlarını (29 dil, `entity_names`) ve güncel para birimini (`entity_xrefs` scheme `currency`) yazar; `territoryInfo`/`territoryContainment` KULLANILMAZ (dossier 🟡). Kodda BM M49 kullanımı yok; kıta/alt-bölge gerekirse kaynak-hak riski olmayan alternatif aranacak.
- **LAU değişimi — kapsam raporu (2026-10-05):** ulusal/doğrulanmış kapsam olan AB27: AT, BE(wd), CZ, DE, BG(wd), DK(wd), ES, FI(wd), FR, IT, NL, PT, SE, PL, LV, SI, HU, GR (18/27) + Wikidata katmanıyla SK, LU, RO (+ LT, EE: 23/27; bunlar topluluk verisi). Eksik 4: CY, HR (resmî kod yok), IE, MT; araştırma notları docs/sources/NATIONAL.md. Hepsi kapanana kadar `gisco-lau` 🔴 kalır (ticari pakette yok; `DISABLE_SOURCES=gisco-lau` ile kapatılabilir). Wikidata `P782` (LAU kodu) ülkeler arası tutarsız (HU 3.475 vs ≈3.155) → kapı olarak kullanılamaz; ülke başına sınıf+sayı yapılandırması (`wikidata-countries.ts`) veya ulusal adaptör gerekir.
- **Scope'lar + metadata (Faz 9):** katalog, `/v1/scopes`, `/v1/schema*`, `/v1/profile` (union/intersect), `scope_profiles`, CLDR öznitelikleri (currency digits, datetime, numbers, measurement, units, calendar, locale), dışa aktarım dosyaları, SDK'lar. Açık: telefon/TLD/posta biçimi için CLDR dışı otomatik kaynak, saat dilimi, sürüş yönü, şehir (`locality`) verisi, cldr-json sürüm etiketine sabitleme, çok dilli ülkelerde birden fazla varsayılan yerel ayar.

## Faz 10 durumu (2026-10-06)
Bitti: tatil doğrulama turu (IT 11/11, SK/LT tek gün, IE St Brigid), eşleme %50→%81, `postal`/`telephony`/`timezones`/`traffic` scope'ları, kota planları, profil imleci, öznitelik değişiklik akışı, SDK paket iskeletleri, golden test, LAU yerine resmî kaynak: **LU ve EE eklendi (AB27 LAU kapsamı 20/27)**. Kalan LAU boşluğu: CY (CYSTAT tablosu LAU2 değil), HR (yalnızca statik arşiv), IE (CSO tabloları sınıflama değil), LT/MT/RO (erişim engeli), SK (2019 kod listesi + zayıf lisans kanıtı). `gisco-lau` kaldırma kararı (C3) bu boşluklarla birlikte kullanıcıya aittir. Detay: docs/PROGRESS.md "Faz 10".

## Faz 8 durumu (2026-10-05)
Bitti: CI (Node ≥22.13, moto S3 e2e, haftalık contracts), `/v1/status` bant karşılaştırması, yasa metni izleme (`check:holiday-law`), Docker/Compose kurulumu (imaj bu ortamda derlenemedi: Docker daemon yok; yalnızca `compose config` doğrulandı), LV hafta sonu devri. Yapılmayacak: TR idari izin günleri (otomasyon kuralı). Kalan: Docker imajının gerçek derleme/çalıştırma doğrulaması, IE St Brigid's Günü (okunmuş kaynak yok), `contracts.yml` ilk gerçek çalıştırması (CI), yasa izlemede 403/503 veren siteler (HR narodne-novine, TR mevzuat, DE gesetze: geçici hata olarak raporlanır).

## Faz 9 sonrası eksikler (2026-10-05; ayrıntı: /root/.claude/plans/faz9-eksikler.md)
**Veri (2026-10-05 güncel):** ÇÖZÜLDÜ: saat dilimi (IANA tzdb), arama kodu/önekler (libphonenumber), sürüş yönü (Wikidata P1622), şehir scope'u, bölgesel/çoklu yerel ayar (248/252), CLDR sürüm sabitleme, sürüm notları, OpenAPI şemaları, TS SDK testi, intersect alt-anahtar daraltma. KALAN: (1) posta kodu biçimi ve TLD yalnızca GeoNames (`contact`): CLDR'de `postalCodeData`/`telephoneCodeData` yok (cldr-json ve cldr deposunda 404), libaddressinput verisinin (gstatic) kullanım şartı okunamadı → eklenmedi, IANA root zone DB ülke eşlemesi vermiyor; (2) `zone.tab` "deprecated" (zone1970.tab Norveç için `Europe/Berlin` gibi kümelenmiş kimlik verir) — kaldırılırsa sözleşme denetimi hata verir; (3) libphonenumber `master` kayan dal, Apache-2.0 4. madde/NOTICE okunmadı (🟡); (4) driving: 251/252 ülke, çelişkili ifadeli ülke atlanır; (5) 4 ülkede yerel ayar yok (uzaydaki/nüfussuz bölgeler); (6) cities scope yalnızca ≥15.000 nüfuslu şehirler, `timezones` (tzdb) ve şehir saat dilimleri ayrı kaynaktan; (6) ölçü: dönüşüm katsayısı/birim adı yok, saat: `availableFormats` yok; (7) para birimi simgesi/yerel adı yok; (8) BM gözlemci durumu (VA, PS) yok.
**Model:** (1) öznitelikler `changes`/webhook akışında ve sürüm notunda yok (CLDR sürüm geçişi bildirilmiyor); (2) `intersect` dinamik anahtarlı nesnelerde (`measurement.units`) çocuk düzeyinde kesiştirmiyor; (3) `cldr-json` `main` dalına bağlı, sürüm etiketine sabitlenmedi; (4) `/v1/schema` doluluk önbelleği süreç içi, `availability` katalogda elle yazılı, `divisions`/`holidays` alan düzeyi doluluk yok; (5) `export_countries` API'yi sınırlamıyor (sözleşmede yazılmalı); (6) `/v1/profile` en çok 50 ülke, imleç yok; (7) anahtar iptalinde profil/varsayılan profil temizliği doğrulanmadı.
**Test/doküman:** TS SDK scope yöntemleri testsiz; OpenAPI'de yanıt şemaları yok; CLDR öznitelikleri `targets.ts`'te (sıklık, bant, lisans izleme, `check:sources` kontratı) kayıtlı değil; yeni CLDR dosyalarının köken beyanı okunmadı (`docs/licenses/cldr.md` 🟡, avukat maddesi); kapsama sayıları için altın-sayı testi yok.
**Önerilen sıra:** sürüm sabitleme → şehir scope'u/katalog düzeltmesi → `targets.ts` kaydı → yerel ayar seçimi → sürüm notu → TS SDK/OpenAPI testleri → yeni kaynak araştırması (otomasyon kuralı kapısıyla). Faz 8 planı (CI, Docker, yasa metni izleme) bağımsız, başlamadı.

## Kullanıcı ağı/ilişkisi gerektirenler (bu konteynerden erişilemedi)
1. **TÜİK** il/ilçe kodları ve İBBS; **data.gov.tr**; **NVİ UAVT/MAKS** (başvuru/lisans); **PTT** posta kodu lisansı. Sonucu `docs/sources/TR.md`'ye yazın, sonra `src/sources/official/tr-tuik.ts`.
2. **Türkiye tatillerini resmi kaynakla doğrulama:** 2429 sayılı Kanun (mevzuat.gov.tr) ve Diyanet dini günler takvimi; `data/holidays/TR.json` içindeki `unverified` → `verified` (+ `checked_on`). 2027–2028 `tentative`.
3. **Fransa** (Légifrance 403) ve **Hollanda** (wetten.overheid.nl) tatil kaynakları.
4. Hukuki lisans teyidi (bkz. `docs/LICENSES.md` "teyit edin" maddeleri); Eurostat GISCO'dan LAU/NUTS ticari kullanım için yazılı teyit istenebilir.

## Geniş kapsamlı plan dizisi
**Ayrıntı: `docs/PLAN-FAZ3.md`** — 3-A güncelleme (refresh) altyapısı, 3-B lisans/ticari kullanım/satış araştırma programı (kaynak başına dossier), 3-C ulusal bölünme dalgaları, 3-D tatiller, 3-E kalite/eşleme, 3-F ürün ve hukuk. Sıra: 3-A ∥ 3-B → 3-C Dalga 1 → 3-D → 3-E → Dalga 4 → Dalga 2/3 → Dalga 5 → 3-F. Durum: 3-A temel altyapı uygulandı (`docs/OPERATIONS.md`), 3-B: 32 dossier `docs/licenses/`'de (indeks: `docs/licenses/README.md`; **🔴: LAU, BM M49, TR (TÜİK), IN**; ⚪: BE, BR), 3-C Dalga 1: SE, CZ, DE, AT, CA, CH, AU ve FR (INSEE) yüklendi, IT xlsx'e geçti (bayat CSV düzeltildi), NO güncel host; GB (ONS, OGL v3) yüklendi (374); ES (INE, 8.203) yüklendi; PT (DGT CAOP, yalnız kıta, 3.345) yüklendi (Açores/Madeira gpkg okunmadı); JP (MIC, 1.965; kaynak dosya R6.1.1 tarihli) yüklendi; sırada FI, Wikidata katmanı (TR/IN/KR/BR/BE/DK/PL), LAU değişimi, CLDR; FI eşleme servisi 500 nedeniyle beklemede.

## Ulusal resmi kaynak programı (yeni, öncelikli)
Hedef: her ülkenin kendi resmi verisinden tüm idari seviyeler (şehir, il, ilçe, eyalet, county, kanton, prefektörlük, bölge, mahalle, sokak…). Çerçeve hazır (`src/sources/national/`, `src/taxonomy.ts`, `/v1/countries/:cc/divisions`); US, FR, IT, NL, NO yüklü. Sırada: SE, GB, JP, AU adaptörleri (önce lisans metni okunacak), CH lisans teyidi, DK yeni adres, CA erişim, TR (kullanıcı ağı). Ülke listesi ve durum: `docs/sources/NATIONAL.md`.
- Sonra: GeoNames katmanını `source_class` ile ayır; `?official_only=true`; ulusal kaynak olan ülkelerde GeoNames'i devre dışı bırakma seçeneği; `entity_links` ile `gn:*` ↔ `div:*` eşleme.

## Konteynerden yapılabilir
1. **Eksik AB tatil dosyaları:** BG (Kodeks na truda čl. 154), RO (Codul muncii art. 139; Ortodoks Paskalya), FR (Légifrance 403, alternatif resmi kaynak?), NL (wetten.overheid.nl erişilemedi), CY (resmi liste bulunamadı; `docs/sources/holidays/CY.md`).
2. **Doğrulanmamış ülkeleri doğrulama** (alternatif resmi kaynak/sürüm ara): BE, LU, FI, GR, LT, MT, SI, DE eyalet yasaları, IT Legge 260/1949, DK birincil helligdag hükmü ve Store Bededag tanımı, PT 2013 öncesi, SK 17 Kasım 2024, SE değişiklikler (SFS 2004 sonrası).
3. **Eksik tatiller:** ES yıllık BOE takvimi ve özerk topluluklar; DE bölgesel günler (`region: nuts:DEx`); IE St Brigid's Day (motora koşullu kural: "Şubat ilk Pazartesisi, 1 Şubat Cuma ise o gün"); GR Temiz Pazartesi/Büyük Cuma/Pentekost Pazartesi; LV hafta sonu devri; IT 4 Ekim.
4. **Eşleme kapsamını artırma:** GeoNames `alternateNamesV2` veya ISO 3166-2 (`iso-codes`, LGPL) ile admin1↔NUTS (şu an %22).
5. **ISO 3166-2 YAPILDI** (2026-10-05; Wikidata P300, `entity_xrefs` scheme `iso3166-2`, `/v1/regions/:id` `xrefs` içinde; admin1'in 3.281/3.603'ü kodlu, admin2/division'da seyrek) ve çok dilli adlar (Wikidata etiketleri + CLDR). Katman QID'leri (`wd-*`) de xref'e yazılıp QID bağlama 1.169 → 10.580 bağa çıktı.
6. **Posta kodları** (GeoNames `postalCodes`, CC BY; ülke lisansı kontrol edilmeli).
7. **LAU↔NUTS3 bağlantısı** (GISCO LAU CSV'sinde yok).
8. **Operasyon:** `npm run ingest:all` + `docs/OPERATIONS.md`, zamanlanmış ingest (cron), API anahtarı/hız sınırı, OpenAPI şeması, SDK'lar.
9. **Resmî Gazete izleyici** (TR idari değişiklik olayları; bu oturumda resmigazete.gov.tr de erişilemedi, önceden 200 idi → tekrar dene).
10. OSM mahalle/sokak (ODbL değerlendirmesi sonrası).

## Yöntem notu (tatil kaynakları)
- Ajanlara ülke grupları verildi; çıktı bağımsız kontrol edildi: URL'ler yeniden çekilip alıntıların kaynakta geçtiği doğrulandı (CZ, HU, SK, PL, LV, IE, SI, EE, DK, HR, PT). Aynı yöntem yeni ülkeler için tekrarlanmalı.
- Aggregator (Nager.Date) yanlış çıkabilir (SK 2026 örneği); yalnızca alarm olarak kullanın.

## Ürün/iş
- Hedef segment seçimi ve 5–10 müşteri görüşmesi; fiyat katmanları (ücretsiz: ülke+admin1; ücretli: delta/webhook, tatiller, SLA).
- İhtilaflı bölge politikası belgesi, sorumluluk reddi, düzeltme bildirim adresi.

## Önemli teknik notlar
- Yerel test DB'si: PostgreSQL 16 `/tmp/pgdata`, soket `/tmp`, veritabanları `countryinfo`, `countryinfo_test`. Konteyner yeniden başlarsa `rm -f /tmp/pgdata/postmaster.pid` + `pg_ctl start` (kullanıcı `postgres`).
- Testler: `TEST_DATABASE_URL=postgres://postgres@localhost:5432/countryinfo_test npm test`.
- NUTS: tek dosya `NUTS_AT_2024.csv` 39 ülkeyi içerir (TR dahil); Eurostat `EL`=Yunanistan (ISO `GR`).
- Kurum siteleri bu konteynerden erişim açısından kararsız; her oturumda yeniden deneyin.

## Faz 6 — Kalan eksikler için plan (2026-10-05 durumundan)

## Kaydedilen ilerleme (commit 7a15898, `claude/country-info-mvp`, push'lu, PR yok; 98 test + tsc yeşil)
- Resmi adaptörler: US, FR, IT, NL, NO, SE, CZ, DE, AT, CA, CH, AU + **GB (374), ES (8.203), PT (3.345, yalnız kıta), JP (1.965)**.
- Wikidata (CC0, topluluk, sayı kapılı): DK 103, FI 327, BE 577, BR 5.599, IN 36, BG 265; QID/çok dilli ad zenginleştirme; CLDR ülke adları + para birimi.
- Model: `source_class`, `?official_only=true`, ülke ve bölge yanıtında `names`/`xrefs`.

## Eksik envanteri
| Alan | Durum | Engel |
|---|---|---|
| LAU yerine AB27 | 13/27 kapsandı; **eksik 14: CY EE GR HR HU IE LT LU LV MT PL RO SI SK** | Wikidata sınıf/sayı eşleşmedi; ulusal adaptör gerekir |
| Wikidata katmanı | PL, KR, TR(ilçe), SI, SK, GR, HR, RO yüklenemedi | sayı kapısı |
| PT Açores/Madeira | YAPILDI 2026-10-05 (GeoPackage, 3.596 kayıt) | — |
| FI/DK/PL/BE/IN/KR/BR resmi kaynak | Wikidata ile geçici | lisans/erişim |
| TR | il/ilçe GeoNames+İBBS; mahalle/sokak yok | NVİ/TÜİK kapalı |
| Tatiller | BG RO FR NL CY dosyası yok; çoğu `unverified` | resmi metin okunmalı |
| Model | `source_priority`/`canonical`, `replaced_by` ardıllık, ETag/ham arşiv | kod |
| Ürün | OpenAPI, API anahtarı, hız sınırı, SDK, webhook `kinds` | kod |
| Hukuk | avukat onayı, ES/PT/JP/GB `partial` açık sorular | lansman öncesi zorunlu |
| Altyapı | Postgres konteyner yeniden başlayınca ölüyor; Wikidata aylık refresh yok | operasyon |

## Sıra (izinsiz; her adım: lisansı oku → dossier → kod → test → `refresh` x2 → docs → commit/push)
**6-A. Dokümantasyonu kaydet** (2026-10-05 yapıldı: bu bölüm ROADMAP'te); sonraki: `docs/licenses/README.md` ve `NATIONAL.md` tutarlılık kontrolü (nat-es/gb/jp/pt satırları).

**6-B. AB27 LAU boşluğu (14 ülke → PL tamamlandı 2026-10-05: GUS BDL, 2.875; kalan 13), kolaydan zora**
1. Önce kamu API'si/CSV'si olan ve lisansı açık olanlar: **PL** (GUS TERYT/TERC; lisans sayfasını oku; 16/380/2.477), **HU** (KSH helységnévtár), **RO** (INS/SIRUTA), **HR** (DZS/ DGU), **SI** (SURS/GURS), **SK** (ŠÚ SR), **GR** (ELSTAT/Kallikratis), **IE** (CSO/OSi). Her biri için `src/sources/national/<cc>.ts` + dossier; ulusal adaptör yoksa Wikidata sınıfını **veriyle** bul (GeoNames xref P31 dağılımı: `.scratch/d.mts` yöntemi) ve resmi sayı bandı koy.
2. Küçük ülkeler (CY, EE, LV, LT, LU, MT): resmi sayı küçük (≤80, CY 615 topluluk) → ulusal istatistik sitesinin lisansı okunur; yoksa Wikidata sınıfı + band.
3. Çıkış ölçütü: AB27'nin 27'si kapsanır → `gisco-lau` için `DISABLE_SOURCES` + bilinçli toplu silme (`maxDeleteRatio`) ve `export --commercial` farkı raporu; `entity_links` ile NUTS3 bağları.

**6-C. Model ve kalite** (2026-10-05: kaynak önceliği + `?canonical=true` yapıldı — `sources.priority` (migration 006, `src/sources/priority.ts`); kalanlar aşağıda; aylık enrich zinciri `refresh.yml`'e eklendi)
- `src/sources/priority.ts`: resmi > Wikidata > GeoNames; `canonical` bayrağı `entity_links`/QID üzerinden (kayıt silinmez); API `?canonical=true`.
- `replaced_by`/`merged_into` ardıllık önerileri YAPILDI (2026-10-05, `src/successors.ts`, refresh sonrası `review_items`; yalnızca öneri). Onay akışı da YAPILDI (`entity_successors`, `POST /v1/review-items/:id/resolve`, `GET /v1/regions/:id/successors`; split_into önerisi de üretilir).
- ETag/If-Modified-Since + ham içerik arşivi YAPILDI (2026-10-05; `src/sources/fetch.ts`, `.cache/raw/<sha256>`, `RAW_ARCHIVE_MAX_MB`). Not: curl yedeği yolu koşullu değil; ham arşiv adaptörlerin `logBody` ile kaydettiği gövdeleri saklar (Wikidata SPARQL yanıtları dahil).
- Wikidata enrich'i `refresh --due` zincirine (aylık) ekle; Wikidata katmanlarında yetim/atlanan öğe raporu.
- Kalite panosu: kaynak başına sayı vs resmi (altın sayı testleri), yetim kayıt kontrolü; `/v1/status` içine.

**6-D. Kapsam derinleştirme**
- PT Açores/Madeira (gpkg okuyucu veya DGT CSV/INE kod tablosu), KR (KOSTAT/MOIS lisansı okunur; Wikidata 17'lik yapı için sınıf eşlemesi), IN ilçe (resmi sayı kaynağı bulunursa), PL powiat/gmina, TR (yalnız lisansı net kaynak; TÜİK/NVİ kapalıysa boş).
- Posta kodları ve mahalle/sokak (Faz 3-C Dalga 5): ayrı kapı — hacim, KVKK/GDPR, posta kodu lisansları; OSM ODbL kararı verilmeden başlamaz.

**6-E. Tatiller**
- FR, NL, BG, RO, CY dosyaları eklendi (2026-10-05; BG tümüyle ve CY büyük çoğunlukla `unverified`, RO 2023 konsolide metne dayanıyor) — kalan iş: bunların güncel resmî metinle doğrulanması (legislatie.just.ro, lex.bg erişimi gerekir); `unverified` → `verified` (BE, LU, FI, GR, LT, MT, SI, DE eyalet, IT, DK, PT, SK, TR); motor: koşullu kural (IE), hafta sonu devri, yarım gün, hicri liste. Nager.Date yalnız alarm. Yıllık Eylül döngüsü.

**6-F. Ürün ve operasyon** (2026-10-05: OpenAPI (`/openapi.json`, rota-eşleşme testi), API anahtarı + dakikalık hız sınırı (`src/access.ts`, `API_KEYS`, `RATE_LIMIT_PER_MIN`) yapıldı; webhook `kinds` zaten vardı; webhook yükünde `source_ids`/`vintage`/`reason` ve TypeScript istemcisi `src/sdk.ts` YAPILDI (2026-10-05); anahtar yönetimi YAPILDI (`api_keys`, migration 008, admin uçları, anahtara özel limit); Python SDK'sı YAPILDI (`sdk/python`); paylaşımlı sınırlayıcı YAPILDI (`RATE_LIMIT_STORE=postgres`, migration 009); kullanım ölçümü YAPILDI (`api_usage`, `/v1/api-keys/usage`, migration 010); kalan: planlar/kota tabloları ve faturalama entegrasyonu — iş kararı gerektirir)
- OpenAPI şeması (Fastify schema'dan), API anahtarı + hız sınırı, SDK (TS/Python), webhook `kinds`/`source_ids`/`vintage`, abonelik filtreleri.
- Konteyner dayanıklılığı: Postgres otomatik başlatma betiği (`scripts/pg-start.sh`, `/usr/lib/postgresql/16/bin/pg_ctl` yolu) ve CI'da Postgres servisi (var), `ingest:all`.
- Lisans: bağımsız ikinci geçiş betiği (`/tmp/xlic.py`'yi `scripts/`e al), `check:licenses` baseline'ları tüm yeni kaynaklar için.

**6-G. Ticari kapı (kodlamadan bağımsız)**
- Avukat onayı: `partial` kaynaklar (ES REL adları, PT/JP/GB API lisans cümlesi), CLDR/Wikidata atıf, CC BY-IGO; ToS/DPA/SLA şablonları; fiyat/segment görüşmeleri.

## Kritik dosyalar
`docs/ROADMAP.md`, `docs/PLAN-FAZ3.md`, `docs/sources/NATIONAL.md`, `docs/licenses/*`, `src/sources/national/*` (+`index.ts`), `src/sources/wikidata-countries.ts` + `wikidata-divisions.ts`, `src/targets.ts`, `src/api.ts`, `src/linking.ts`, `src/ingest.ts`, `src/export.ts`; yeniden kullanılacak: `parseCsv` (`src/sources/csv.ts`), `readXlsx` (`src/sources/xlsx.ts`), `fetchText/fetchBytes` (`src/sources/fetch.ts`), `division()` (`src/sources/national/types.ts`), `loadWikidataDivisions`.

## Doğrulama
`TEST_DATABASE_URL=postgres://postgres@localhost:5432/countryinfo_test npx vitest run`, `npx tsc --noEmit -p .`; her yeni kaynak `npm run refresh -- --source <id> --force` sonra bir kez daha ("unchanged"); birim sayıları resmi rakamlarla; `export --commercial` 🔴 kaynakları dışlar; her adım sonrası commit + push (PR yalnız istenirse). Postgres ölürse: `rm -f /tmp/pgdata/postmaster.pid; su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata -l /tmp/pg.log -o '-p 5432 -k /tmp' start"`.

## Riskler
- Wikidata topluluk verisi: sayı kapısı olmadan yüklenmez; hafızadan QID kullanılmaz (Q2039348 örneği yanlış çıktı).
- Resmi siteler konteynerden kararsız (WAF); curl yedeği var, bazıları okunamazsa kaynak alınmaz.
- Ticari lansman avukat onayı olmadan yapılmaz.
