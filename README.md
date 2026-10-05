# country-info

Ülkeler ve idari bölgeler (eyalet, il, ilçe …) için sürümlü bir veri servisi. Veriyi **REST API** ve **indirilebilir dosyalar** olarak sunar; güncellemeleri izler ve değişiklikleri **delta** (API + dosya) ve **webhook** ile bildirir.

## Durum (MVP)

| Kapsam | Durum |
|---|---|
| Ülkeler / bölgeler (ISO 3166-1, 252 kayıt; `un_status`: member 193, observer 2, other 57) | ✅ |
| Alt bölgeler: admin1 (~3.9k) ve admin2 (~47k) – GeoNames | ✅ |
| Ülke nitelikleri: para birimi, diller, telefon kodu, posta kodu biçimi, komşular, TLD | ✅ |
| Snapshot + değişiklik günlüğü (delta), cursor tabanlı API | ✅ |
| Webhook (HMAC imzalı, yeniden deneme, ülke filtresi) | ✅ |
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

Erişim: `API_KEYS=k1,k2` ayarlanırsa `/v1/*` için `x-api-key` (veya `Authorization: Bearer <anahtar>`) gerekir; boşsa API açıktır. `RATE_LIMIT_PER_MIN` (varsayılan 600, 0 = sınırsız) anahtar (yoksa IP) başına dakikalık sınır; yanıtlarda `X-RateLimit-*`, aşımda `429` + `Retry-After`. Sınırlayıcı süreç içidir (çok örnekte önüne paylaşımlı sınırlayıcı koyun). `ADMIN_TOKEN` her zaman geçerli anahtardır.

POST /v1/webhooks   {url, countries?, kinds?}   (Authorization: Bearer $ADMIN_TOKEN; secret yalnızca yanıtta görünür)
GET/DELETE /v1/webhooks[/:id]
GET  /files/manifest.json, /files/latest/*, /files/snapshots/<id>/*
```

### Delta nasıl tüketilir
`/v1/changes?since=0` ile başlayın; yanıttaki `next_seq` değerini saklayıp bir sonrakinde `since` olarak verin. Her kayıt `op` (`insert|update|delete`), `changed_fields` (ör. `name`, `data.population`), `before` ve `after` içerir.

### Webhook
Her ingest sonrası değişiklik varsa abonelere `snapshot.completed` bildirimi gider (küçük gövde; veri `changes_url` ile çekilir). Başlıklar: `x-countryinfo-signature: sha256=HMAC(secret, "<timestamp>.<body>")`, `x-countryinfo-timestamp`, `x-countryinfo-delivery`. 2xx dışı yanıtta 30s·2ⁿ ile 8 denemeye kadar tekrar denenir.

### Dosyalar
`snapshots/<id>/` altında `countries.json`, `countries.csv`, `regions.ndjson`, `holidays.ndjson`, `holidays.csv`, `delta.ndjson`; `latest/` en son kopya; `manifest.json` boyut ve sha256 içerir.

## Lisans ve atıf
Kaynak lisansları `docs/LICENSES.md`'de. GeoNames verisi CC-BY 4.0'dır; dağıtılan veride atıf gerekir. İleride eklenecek OpenStreetMap verisi ODbL'dir (atıf + share-alike). Ayrıntı: `docs/DESIGN.md`.
