# country-info – çalışma notları

Ülkeler/idari bölgeler/tatiller için sürümlü veri servisi (TypeScript, Fastify, PostgreSQL). Ayrıntı: `README.md`, `docs/DESIGN.md`.

**Oturuma başlarken önce `docs/PROGRESS.md` (özet) ve `docs/ROADMAP.md` dosyalarını okuyun** (kalan işler ve ağ gerektirenler orada) ve bitirdiğiniz işi oradan güncelleyin.

## Değişmez kurallar
- **Otomasyon kuralı:** Yalnızca her `refresh`'te kendiliğinden, makinece okunabilir ve kararlı bir URL/biçimden çekilebilen kaynaktan veri alınır. Elle girilen yıllık liste, depoya konan statik dosya, SPA/PDF'ten elle kopyalanan tablo, **hafızadan yazılan liste** veri kaynağı olamaz. Yıllık değişen tarihler (ör. dini bayramlar) resmî kaynaktan otomatik beslemeyle gelir (`src/holidays/feeds.ts`); yayımlanmamış yıl için kayıt üretilmez, tahmin edilmez. Kanundan türeyen kurallar (sabit gün, Paskalya ofseti, koşullu kural) `data/holidays/` içinde **kural** olarak durabilir; yıllık liste yazmak yasaktır. Otomatikleştirilemeyen kaynak yüklenmez, eksik alan boş kalır ve `docs/PROGRESS.md`'de nedeniyle yazılır.
- **Veri kaynağı eklemeden önce lisansını kaynak sayfasından okuyun** ve `docs/LICENSES.md`'ye yazın. Lisansı belirsiz/ticari kısıtlı kaynaktan (PTT, NVİ, TÜİK, GISCO "administrative units", OSM şart kontrolü olmadan) veri almayın.
- Her `Source` için `attribution` doldurun; `/v1/sources` ve `ATTRIBUTION.md` buradan beslenir.
- Tatil kayıtlarında `verification: verified` **yalnızca** atıf yapılan resmi metin gerçekten okunduysa (`source.checked_on` ve `url` dolu) kullanılır. Nager.Date yalnızca alarmdır, veri kaynağı değildir.
- Bilmediğiniz resmi bilgiyi hafızadan yazmayın; okuyamadığınız şeyi `unverified` bırakın ve belgeleyin.
- `ingest()` kaynağın kendi kayıtlarını siler; başka kaynağın kimliğini sahiplenmez. Silme koruması %5.

- Ulusal kaynak (ülke adaptörü) eklerken `docs/sources/NATIONAL.md`'deki sırayı izleyin; `licenseStatus: 'unread'` kaynak yüklenmez, `partial` ise nedeni `meta.license`'a açıkça yazılır.
- İdari birimler `division` kind'ıdır (`data.level`, `data.type` ortak sözlükten `src/taxonomy.ts`, `data.type_local` yerel ad).

- Kaynak güncellemesi `docs/OPERATIONS.md`'deki `refresh` ile yapılır (ham hash, bant, vintage, lisans izleme); yeni kaynak `src/targets.ts`'e sıklık, satır bandı ve lisans sayfalarıyla eklenir.
- **Satış kuralı:** `license_verdict` green/amber olmayan kaynak (şu an `gisco-lau` 🔴, BM M49 🔴) ticari pakete girmez; satılan/dağıtılan çıktı `npm run export -- --commercial` ile üretilir. Yazılı teyit listesi: `docs/licenses/OUTREACH.md`.
- **Scope'lar:** yeni ülke bilgisi `src/scopes/catalog.ts`'e alan/scope + `resolve.ts`'e çözücü olarak eklenir (test eşleşmeyi zorlar); yeni uç `src/openapi.ts`'e girer. Öznitelik kaynağı otomasyon kuralına uymalıdır.
- Her kaynağın lisans dossier'i `docs/licenses/<source-id>.md` (şablon: `TEMPLATE.md`); dossier'siz kaynak ticari pakete girmez.

## Komutlar
`npm run refresh [-- --due|--source id|--force|--dry-run] | check:sources | check:licenses | license:ack -- <id> | check:holiday-law | holiday-law:ack -- <url|all> | ingest | ingest:gisco | ingest:national <CC|all> | ingest:holidays | link | enrich:wikidata | enrich:cldr (ülke adları, para birimi, UN, tarih/saat/sayı/ölçü öznitelikleri) | check:holidays | export | publish [-- --profile p | --rollback id] | digest | deliver | serve`, `scripts/cron/run-cycle.sh` (üretim güncelleme döngüsü; bkz. docs/OPERATIONS.md), `scripts/pg-start.sh` (yerel Postgres'i başlatır; konteyner yeniden başlayınca gerekir), `npm test` (+ `TEST_DATABASE_URL`), `npx tsc --noEmit -p .`
