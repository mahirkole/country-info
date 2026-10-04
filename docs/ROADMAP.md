# Yol haritası ve kalan işler (sonraki oturumlar için)

Son güncelleme: 2026-10-04. Dal: `claude/country-info-mvp` (PR açılmadı). Her maddeyi bitirince burayı güncelleyin.

## Tamamlandı
- MVP: GeoNames ülke/admin1/admin2 ingest, snapshot/delta/webhook, dosya dışa aktarım.
- Çok kaynaklı ingest + provenance (`sources`, `source_id`), kaynaklar birbirini silmez, silme koruması (%5).
- Eurostat GISCO: NUTS (AB27 + TR İBBS = 1.620) ve LAU (AB27 ≈ 95k).
- Tatil kural motoru; TR (unverified), AT (13/13 verified), ES (4/4), IT (6/11), DE (1/9).
- GeoNames↔NUTS ad eşlemesi (770 admin1'den 169 bağ), `/v1/review-items`.
- Atıf: `sources.attribution`, `/v1/sources`, `ATTRIBUTION.md`; lisans okuma bulguları `docs/LICENSES.md`.

## Kullanıcı ağı/ilişkisi gerektirenler (bu konteynerden erişilemedi)
1. **TÜİK** il/ilçe kodları ve İBBS; **data.gov.tr**; **NVİ UAVT/MAKS** (başvuru/lisans); **PTT** posta kodu lisansı. Sonucu `docs/sources/TR.md`'ye yazın, sonra `src/sources/official/tr-tuik.ts`.
2. **Türkiye tatillerini resmi kaynakla doğrulama:** 2429 sayılı Kanun (mevzuat.gov.tr) ve Diyanet dini günler takvimi; `data/holidays/TR.json` içindeki `unverified` → `verified` (+ `checked_on`). 2027–2028 `tentative`.
3. **Fransa** (Légifrance 403) ve **Hollanda** (wetten.overheid.nl) tatil kaynakları.
4. Hukuki lisans teyidi (bkz. `docs/LICENSES.md` "teyit edin" maddeleri); Eurostat GISCO'dan LAU/NUTS ticari kullanım için yazılı teyit istenebilir.

## Konteynerden yapılabilir
1. **AB27 kalan 19 ülkenin tatilleri** (BE, BG, HR, CY, CZ, DK, EE, FI, GR, HU, IE, LV, LT, LU, MT, PL, PT, RO, SK, SI, SE): her ülke için resmi metni okuyup `data/holidays/<CC>.json` yaz, yalnızca okunanı `verified` yap.
2. **Eksik tatiller:** ES yıllık BOE takvimi (6 Ocak, Viernes Santo, 1 Kasım, 6/8 Aralık…) ve özerk topluluklar; DE eyalet tatilleri (`region: nuts:DEx`); IT Legge 260/1949 metni (kalan 5 gün), IT 4 Ekim durumu; AT/DE/IT bölgesel/yerel günler.
3. **Eşleme kapsamını artırma:** GeoNames `alternateNamesV2` (çok dilli adlar) veya ISO 3166-2 (`iso-codes`, LGPL) ile admin1↔NUTS (şu an %22).
4. **ISO 3166-2** kodları (`data.iso3166_2`) ve çok dilli adlar (CLDR/alternateNames).
5. **Şehirler** (GeoNames `cities15000`) ve **posta kodları** (GeoNames `postalCodes`, CC BY).
6. **LAU↔NUTS3 bağlantısı** (GISCO LAU CSV'sinde yok; ayrı eşleme dosyası araştırılacak).
7. **Operasyon:** `npm run ingest:all` + `docs/OPERATIONS.md`, zamanlanmış ingest (cron), API anahtarı/hız sınırı, OpenAPI şeması, SDK'lar.
8. **Resmî Gazete izleyici** (TR idari değişiklik olayları; Resmî Gazete erişilebilir).
9. OSM mahalle/sokak (ODbL değerlendirmesi sonrası).

## Ürün/iş
- Hedef segment seçimi ve 5–10 müşteri görüşmesi; fiyat katmanları (ücretsiz: ülke+admin1; ücretli: delta/webhook, tatiller, SLA).
- İhtilaflı bölge politikası belgesi, sorumluluk reddi, düzeltme bildirim adresi.

## Önemli teknik notlar
- Yerel test DB'si: PostgreSQL 16 `/tmp/pgdata`, soket `/tmp`, veritabanları `countryinfo`, `countryinfo_test`. Konteyner yeniden başlarsa `rm -f /tmp/pgdata/postmaster.pid` + `pg_ctl start` (kullanıcı `postgres`).
- Testler: `TEST_DATABASE_URL=postgres://postgres@localhost:5432/countryinfo_test npm test`.
- NUTS: tek dosya `NUTS_AT_2024.csv` 39 ülkeyi içerir (TR dahil); Eurostat `EL`=Yunanistan (ISO `GR`).
- Kurum siteleri bu konteynerden erişim açısından kararsız; her oturumda yeniden deneyin.
