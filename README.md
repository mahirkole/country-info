# country-info

Ülkeler ve idari bölgeler (eyalet, il, ilçe …) için sürümlü bir veri servisi. Veriyi **REST API** ve **indirilebilir dosyalar** olarak sunar; güncellemeleri izler ve değişiklikleri **delta** (API + dosya) ve **webhook** ile bildirir.

## Durum (MVP)

| Kapsam | Durum |
|---|---|
| Ülkeler / bölgeler (ISO 3166-1, 252 kayıt; `un_status`: member 193, other 59 — CLDR'den okunur, gözlemci ayrımı yok) | ✅ |
| Alt bölgeler: admin1 (~3.9k) ve admin2 (~47k) – GeoNames | ✅ |
| Ülke nitelikleri: para birimi, diller, telefon kodu, posta kodu biçimi, komşular, TLD | ✅ |
| Snapshot + değişiklik günlüğü (delta), cursor tabanlı API | ✅ |
| Webhook (HMAC imzalı, yeniden deneme, ülke/tür/olay filtresi, müşteri başına abonelik, teslimat günlüğü, yeniden gönderme) | ✅ |
| Sürüm notları, e-posta özeti, imzalı dosya paketleri (S3/yerel), üretim zamanlaması | ✅ |
| Dosya dışa aktarım (JSON/CSV/NDJSON + manifest + sha256) | ✅ |
| Çok kaynaklı ingest + provenance (`source_id`, `sources`), kaynaklar birbirini silmez | ✅ |
| AB27 + Türkiye NUTS/İBBS (1.620 kayıt) ve AB27 LAU (≈95k belediye) – Eurostat GISCO | ✅ |
| Resmi tatiller: kural motoru + 23 ülke dosyası (TR + AB27'den 22; 10 ülkenin kuralları tamamen resmi metinden doğrulanmış, bkz. `docs/sources/EU-holidays.md`). BG, CY, FR, NL, RO henüz yok | 🟡 |
| GeoNames↔NUTS ad eşlemesi (`npm run link`; 770 admin1'den ~170'i eşleşir, kalanı GeoNames'in İngilizce adları yüzünden eşleşmez) | 🟡 |
| TÜİK/NVİ, BG/CY/FR/NL/RO tatilleri | ⏳ |
| Ulusal resmi kaynaklar (ülke başına adaptör, `division` kayıtları): US (3,3k), FR (35k), IT (8k), NL (358), NO (372) yüklü; CH lisans nedeniyle bloklu; JP/SE/GB/AU sırada (`docs/sources/NATIONAL.md`) | 🟡 |
| Şehirler: GeoNames `cities15000` (34.152 yerleşim, saat dilimi ve nüfus dahil) | ✅ |
| Mahalle, sokak (OpenStreetMap), posta kodları | ⏳ bkz. `docs/DESIGN.md` |

## Hızlı başlangıç

```bash
cp .env.example .env            # DATABASE_URL vb.
npm install
npm run ingest                  # migrate + GeoNames'ten içe aktar (idempotent)
npm run ingest:gisco            # NUTS (AB27+TR) ve LAU (AB27); önce `ingest` gerekir
npm run ingest:holidays         # data/holidays/*.json -> tatil kayıtları
npm run ingest:national <CC|all>  # ülkenin kendi resmi kaynağı (US, FR, IT, NL, NO)
npm run link                    # GeoNames admin1 <-> NUTS eşleme
npm run check:holidays [yıl]    # tatilleri Nager.Date ile karşılaştırır (yalnızca alarm)
npm run export                  # out/ altına dosyaları yaz
npm run serve                   # API :3000 (+ webhook işçisi)
npm test                        # TEST_DATABASE_URL ile DB testleri de çalışır
```

## API

```
GET  /v1/countries?un_status=member&continent=EU&limit=&after=
GET  /v1/countries/:iso2
GET  /v1/countries/:iso2/regions?level=1|2
GET  /v1/countries/:iso2/divisions?level=&type=&source=   # ulusal kaynaklı idari birimler
GET  /v1/regions/:id            GET /v1/regions/:id/children
GET  /v1/search?q=ist&country=TR&kind=admin1&official_only=true
                                 (official_only: yalnızca source_class=official kaynakların kayıtları; canonical=true: bağlı kayıtlardan yalnızca en yüksek öncelikli kaynağınki (resmi > wd-* > GeoNames); children/divisions/regions/search'te geçerli)
                                 /v1/regions/:id yanıtı: names{lang:ad} (Wikidata), xrefs (QID), links
GET  /v1/countries/:iso2/holidays?year=&region=<entity id>&type=   # region verilmezse yalnızca ülke geneli
GET  /v1/holidays?date=YYYY-MM-DD&country=
GET  /v1/holidays/coverage       # ülke başına doğrulanmış/doğrulanmamış tatil sayısı
GET  /v1/review-items            # (admin) belirsiz eşlemeler
GET  /v1/snapshots
GET  /v1/changes?since=<seq>&until=&country=TR,DE&kind=&limit=   # delta akışı
GET  /openapi.json              (OpenAPI 3 açıklaması; her /v1 rotası test ile belgede zorunlu)

Erişim: `API_KEYS=k1,k2` ayarlanırsa `/v1/*` için `x-api-key` (veya `Authorization: Bearer <anahtar>`) gerekir; boşsa API açıktır. `RATE_LIMIT_PER_MIN` (varsayılan 600, 0 = sınırsız) anahtar (yoksa IP) başına dakikalık sınır; yanıtlarda `X-RateLimit-*`, aşımda `429` + `Retry-After`. Sınırlayıcı varsayılan olarak süreç içidir; birden çok API örneği için `RATE_LIMIT_STORE=postgres` sayaçları ortak veritabanında tutar (istek başına bir UPSERT). `ADMIN_TOKEN` her zaman geçerli anahtardır. Veritabanında yönetilen anahtarlar: `POST /v1/api-keys {name, rate_per_min?}` (anahtar yalnızca yanıtta görünür, saklanan yalnızca SHA-256; `ci_…`), `GET /v1/api-keys`, `GET /v1/api-keys/usage?from=&to=` (anahtar × gün istek sayısı; env anahtarları/admin `key_id` 0), `DELETE /v1/api-keys/:id` (iptal ≤30 sn'de etkili); `REQUIRE_API_KEY=true` ile env anahtarı olmadan da anahtar zorunlu kılınır; anahtara özel `rate_per_min` sunucu varsayılanını ezer (0 = sınırsız).

İstemci (TypeScript, bağımlılıksız): `import { CountryInfo } from './src/sdk'` — `new CountryInfo({ baseUrl, apiKey })`; `for await (const c of client.countries())`, `client.regions('DE')`, `client.divisions('FR', { level: 2 })`, `client.holidays('TR', 2026)`, `client.search('ist')`; değişiklik akışı `for await (const ch of client.changes(sinceSeq))` (üreteç sonunda devam imleci döner); 429'da `Retry-After` kadar bekleyip bir kez yeniden dener, hatalar `ApiError`.

Dağıtım uçları her iki istemcide de var: `createWebhook/webhooks/deleteWebhook/webhookDeliveries/replayDelivery/testWebhook`, `releases()/release(id)`, `exportsLatest()` + `download(dosya)` (sha256 doğrular) ve alıcı tarafında `verifyWebhook(secret, body, timestamp, signature)` (Python: `create_webhook`, …, `verify_webhook`).

Python istemcisi (yalnızca standart kütüphane): `sdk/python/countryinfo` — `CountryInfo(base_url, api_key=...)`, aynı yöntemler ve `changes(since)` (`last_cursor` devam imleci); testler: `cd sdk/python && python3 -m unittest discover -s tests`.

Webhook yükü (`snapshot.completed`): `source`, `source_ids`, `vintage` (kaynağın sürümü), `reason` (sürüm geçişiyse `vintage_change: …`), `from_seq`/`to_seq`, `totals`, `changes_by_country`, `changes_url`.

POST /v1/webhooks   {url, countries?, kinds?, events?}   (müşteri: kendi API anahtarıyla; admin: ADMIN_TOKEN ile hepsini yönetir; secret yalnızca yanıtta görünür)
GET/DELETE /v1/webhooks[/:id]
GET  /v1/webhooks/:id/deliveries        teslimat günlüğü (durum, deneme, hata, yük)
POST /v1/webhooks/:id/deliveries/:did/replay   teslimatı yeniden gönder
POST /v1/webhooks/:id/test              webhook.test olayı kuyruğa alır
GET  /v1/releases[/:id]                 insan okunur sürüm notları (yalnızca satışa uygun kaynaklar)
GET  /v1/exports/latest                 anahtarın profili için en son dosya paketi + imzalı indirme bağlantıları
GET  /files/manifest.json, /files/latest/*, /files/snapshots/<id>/*   (EXPORT_DIR'in ham, profilsiz dökümü; müşterilere /v1/exports/latest verin)
```

### Delta nasıl tüketilir
`/v1/changes?since=0` ile başlayın; yanıttaki `next_seq` değerini saklayıp bir sonrakinde `since` olarak verin. Her kayıt `op` (`insert|update|delete`), `changed_fields` (ör. `name`, `data.population`), `before` ve `after` içerir.

### Webhook
Olaylar: `snapshot.completed` (her ingest sonrası değişiklik varsa; küçük gövde, veri `changes_url` ile çekilir), `release.published` (sürüm notu üretildi: `release_id`, `title`, `totals`, `changes_by_country`, `release_url`), `release.retracted` (yayın geri çekildi), `webhook.test`. Abonelik `events` (varsayılan hepsi), `countries`, `kinds` ile süzülür. Başlıklar: `x-countryinfo-signature: sha256=HMAC(secret, "<timestamp>.<body>")`, `x-countryinfo-timestamp`, `x-countryinfo-delivery`, `x-countryinfo-event`. 2xx dışı yanıtta 30s·2ⁿ ile 8 denemeye kadar tekrar denenir; başarısızlar günlükten `replay` ile yeniden gönderilir. **Webhook yalnızca uyandırıcıdır:** kaçırılan bir teslimat veriyi kaybettirmez — son işlenen `to_seq` ile `/v1/changes?since=` çağırarak telafi edin.

### Sürüm notları ve e-posta
Her uygulanan güncelleme için Markdown sürüm notu üretilir (ülke/tür sayıları, en çok değişen alanlar, örnek eklenen/silinen kayıtlar, vintage geçişi). `GET /v1/releases` yalnızca satışa uygun (green/amber) kaynakları gösterir. E-posta özeti: admin `POST /v1/release-subscribers {email, frequency: instant|weekly}`; `weekly` abone haftada bir özet alır, vintage geçişi/silme/büyük değişim anında gider (`npm run digest`, `MAIL_WEBHOOK_URL`; yerelde deneme: `node scripts/dev/mail-sink.mjs`). Atom akışı: `GET /v1/releases.atom` (diğer `/v1` uçları gibi API anahtarıyla).

### Dosya paketleri (müşteri dağıtımı)
`npm run publish` yeni snapshot'ları iki profille dışa aktarıp nesne depolamaya yükler: `commercial` (yalnızca satışa uygun kaynaklar; müşterilere) ve `full` (iç kullanım). Önce dosyalar, **en son** `manifest.json` yüklenir. Her snapshot'ın `delta.ndjson`'ı vardır; tam veri yalnızca en yeni snapshot'ta. Müşteri `GET /v1/exports/latest` ile kısa ömürlü (15 dk) imzalı bağlantıları alır (API anahtarının `export_profile`'ı belirler; `commercial` varsayılan). Depolama: `PUBLISH_STORE=fs` (yerel dizin, API `/dl/…` ile HMAC imzalı bağlantı) veya `s3` (S3 uyumlu: AWS, MinIO, R2; `S3_ENDPOINT/BUCKET/REGION/ACCESS_KEY/SECRET_KEY`). **Ülke bazlı paket:** tam snapshot her ülke için `by-country/<CC>/{country.json,regions.ndjson,holidays.ndjson}` ve değişiklik olan ülkeler için `delta.ndjson` içerir. API anahtarı `export_countries` (ISO alpha-2 listesi) ile oluşturulursa `/v1/exports/latest` yalnızca bu ülkelerin bağlantılarını `by_country` altında verir (genel dosyalar verilmez); kısıtsız anahtar `?country=DE,FR` ile istediği ülkeleri seçebilir. Geri alma: `npm run publish -- --rollback <snapshotId>`.

### Dosyalar (ham dışa aktarım)
`snapshots/<id>/` altında `countries.json`, `countries.csv`, `regions.ndjson`, `holidays.ndjson`, `holidays.csv`, `delta.ndjson`; `latest/` en son kopya; `manifest.json` boyut ve sha256 içerir.

## Lisans ve atıf
Kaynak lisansları `docs/LICENSES.md`'de. GeoNames verisi CC-BY 4.0'dır; dağıtılan veride atıf gerekir. İleride eklenecek OpenStreetMap verisi ODbL'dir (atıf + share-alike). Ayrıntı: `docs/DESIGN.md`.
