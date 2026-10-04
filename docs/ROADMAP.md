# Yol haritası ve kalan işler (sonraki oturumlar için)

Son güncelleme: 2026-10-04. Dal: `claude/country-info-mvp` (PR açılmadı). Her maddeyi bitirince burayı güncelleyin.

## Tamamlandı
- MVP: GeoNames ülke/admin1/admin2 ingest, snapshot/delta/webhook, dosya dışa aktarım.
- Çok kaynaklı ingest + provenance (`sources`, `source_id`), kaynaklar birbirini silmez, silme koruması (%5).
- Eurostat GISCO: NUTS (AB27 + TR İBBS = 1.620) ve LAU (AB27 ≈ 95k).
- Tatil kural motoru (sabit, Paskalya, n. hafta günü, `on_or_after`, listeli) ve 23 ülke dosyası; doğrulama durumu `docs/sources/EU-holidays.md` (10 ülke tam doğrulanmış). Ajan okuma notları `docs/sources/holidays/`.
- GeoNames şehirleri (`cities15000`, 34.152 kayıt).
- GeoNames↔NUTS ad eşlemesi (770 admin1'den 169 bağ), `/v1/review-items`.
- Atıf: `sources.attribution`, `/v1/sources`, `ATTRIBUTION.md`; lisans okuma bulguları `docs/LICENSES.md`.

## Kullanıcı ağı/ilişkisi gerektirenler (bu konteynerden erişilemedi)
1. **TÜİK** il/ilçe kodları ve İBBS; **data.gov.tr**; **NVİ UAVT/MAKS** (başvuru/lisans); **PTT** posta kodu lisansı. Sonucu `docs/sources/TR.md`'ye yazın, sonra `src/sources/official/tr-tuik.ts`.
2. **Türkiye tatillerini resmi kaynakla doğrulama:** 2429 sayılı Kanun (mevzuat.gov.tr) ve Diyanet dini günler takvimi; `data/holidays/TR.json` içindeki `unverified` → `verified` (+ `checked_on`). 2027–2028 `tentative`.
3. **Fransa** (Légifrance 403) ve **Hollanda** (wetten.overheid.nl) tatil kaynakları.
4. Hukuki lisans teyidi (bkz. `docs/LICENSES.md` "teyit edin" maddeleri); Eurostat GISCO'dan LAU/NUTS ticari kullanım için yazılı teyit istenebilir.

## Geniş kapsamlı plan dizisi
**Ayrıntı: `docs/PLAN-FAZ3.md`** — 3-A güncelleme (refresh) altyapısı, 3-B lisans/ticari kullanım/satış araştırma programı (kaynak başına dossier), 3-C ulusal bölünme dalgaları, 3-D tatiller, 3-E kalite/eşleme, 3-F ürün ve hukuk. Sıra: 3-A ∥ 3-B → 3-C Dalga 1 → 3-D → 3-E → Dalga 4 → Dalga 2/3 → Dalga 5 → 3-F. Durum: 3-A temel altyapı uygulandı (`docs/OPERATIONS.md`), 3-B dossier araştırması sürüyor (ilk 6 dossier `docs/licenses/`'de; **LAU ve BM M49 🔴**), 3-C henüz başlamadı.

## Ulusal resmi kaynak programı (yeni, öncelikli)
Hedef: her ülkenin kendi resmi verisinden tüm idari seviyeler (şehir, il, ilçe, eyalet, county, kanton, prefektörlük, bölge, mahalle, sokak…). Çerçeve hazır (`src/sources/national/`, `src/taxonomy.ts`, `/v1/countries/:cc/divisions`); US, FR, IT, NL, NO yüklü. Sırada: SE, GB, JP, AU adaptörleri (önce lisans metni okunacak), CH lisans teyidi, DK yeni adres, CA erişim, TR (kullanıcı ağı). Ülke listesi ve durum: `docs/sources/NATIONAL.md`.
- Sonra: GeoNames katmanını `source_class` ile ayır; `?official_only=true`; ulusal kaynak olan ülkelerde GeoNames'i devre dışı bırakma seçeneği; `entity_links` ile `gn:*` ↔ `div:*` eşleme.

## Konteynerden yapılabilir
1. **Eksik AB tatil dosyaları:** BG (Kodeks na truda čl. 154), RO (Codul muncii art. 139; Ortodoks Paskalya), FR (Légifrance 403, alternatif resmi kaynak?), NL (wetten.overheid.nl erişilemedi), CY (resmi liste bulunamadı; `docs/sources/holidays/CY.md`).
2. **Doğrulanmamış ülkeleri doğrulama** (alternatif resmi kaynak/sürüm ara): BE, LU, FI, GR, LT, MT, SI, DE eyalet yasaları, IT Legge 260/1949, DK birincil helligdag hükmü ve Store Bededag tanımı, PT 2013 öncesi, SK 17 Kasım 2024, SE değişiklikler (SFS 2004 sonrası).
3. **Eksik tatiller:** ES yıllık BOE takvimi ve özerk topluluklar; DE bölgesel günler (`region: nuts:DEx`); IE St Brigid's Day (motora koşullu kural: "Şubat ilk Pazartesisi, 1 Şubat Cuma ise o gün"); GR Temiz Pazartesi/Büyük Cuma/Pentekost Pazartesi; LV hafta sonu devri; IT 4 Ekim.
4. **Eşleme kapsamını artırma:** GeoNames `alternateNamesV2` veya ISO 3166-2 (`iso-codes`, LGPL) ile admin1↔NUTS (şu an %22).
5. **ISO 3166-2** (`data.iso3166_2`) ve çok dilli adlar (şehir/bölge için alternateNames/CLDR).
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
