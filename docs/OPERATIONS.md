# İşletme: güncelleme (refresh) ve lisans izleme

## Mantık
Her kaynak (`src/targets.ts`) bir **sıklık** (`cadence`), beklenen satır **bandı**, ve lisans sayfaları listesi taşır. `npm run refresh` kaynağı **her zaman yayıncıdan yeniden indirir** (önbellek 0), indirilen ham gövdelerin sha256'sını hesaplar ve:

| Durum | Anlamı | Ne olur |
|---|---|---|
| `unchanged` | Ham girdi son başarılı çalıştırmayla aynı | Veritabanına **hiç yazılmaz** |
| `success` | Uygulandı | Snapshot + değişiklik günlüğü (delta) + webhook |
| `needs_review` | Güvenlik bandı/koruması tetiklendi | **Hiçbir şey yazılmaz**; kaynak `needs_review`, sonraki çalıştırma yine dener |
| `failed` | İndirme/ayrıştırma hatası | Yazılmaz; 1 saat sonra tekrar due |
| `skipped` | Başka bir çalıştırma kilidi tutuyor veya lisans sayfası değişti | Yazılmaz |

`needs_review` nedenleri: (1) kayıt sayısı beklenen bandın dışında, (2) hiyerarşi bozuk (batch'te olmayan üst kayıt), (3) silme oranı > %5 (vintage geçişinde %30), (4) güncelleme+silme oranı > %50 (vintage geçişinde sınırsız).

**Vintage (yıllık sürüm) geçişi:** kaynağın `meta.version` değeri değişirse (ör. `NUTS 2024` → `NUTS 2027`) büyük değişim kabul edilir ve snapshot'a `reason = "vintage_change: <eski> -> <yeni>"` yazılır. Sürüm numarası adaptörde elle güncellenir (URL/yıl değişince); yeni yıl dosyası aynı sürüm etiketiyle gelirse oran koruması devreye girer ve inceleme ister.

## Komutlar
```
npm run refresh -- --due                 # sırası gelen kaynaklar (cron bunu çalıştırır)
npm run refresh -- --source nat-it       # tek kaynak (virgülle birden çok)
npm run refresh -- --source nat-it --force   # ham girdi aynı olsa da çalıştır
npm run check:sources                    # = refresh --dry-run: indir, doğrula, hiçbir şey yazma
npm run check:licenses [id]              # lisans sayfası parmak izi (ilk çalıştırma = baseline)
npm run license:ack -- <id>              # lisans sayfasını okuyup onayladıktan sonra kaynağı serbest bırak
npm run enrich:wikidata [-- --spec geonames --limit N --langs en,tr]   # Wikidata (CC0): QID, çok dilli adlar; sonra `npm run link`
npm run enrich:cldr                      # CLDR (Unicode License v3): ülke adları (29 dil) + güncel para birimi; yalnızca territories.json ve currencyData
```
Çıkış kodu 1: en az bir kaynak `failed`/`needs_review` (veya lisans `changed`/`error`).

**Dışa aktarım:** `regions.ndjson` country/holiday dışındaki tüm kayıtları (division, NUTS, GeoNames bölge/şehir) içerir; her kayıt `source_id` taşır (atıf metni için `ATTRIBUTION.md` / `/v1/sources`).

**Aylık zincir:** `refresh.yml` her ayın 1'inde (ve elle çalıştırmada) `enrich:wikidata`, `enrich:cldr`, `link` çalıştırır; hata bu adımlarda uyarı olarak raporlanır, refresh sonucunu gizlemez.

**Wikidata zenginleştirme:** `enrich:wikidata` `entity_xrefs` (QID; `value` NULL = arandı, tekil eşleşme yok) ve `entity_names` (çok dilli ad) tablolarını doldurur; ≤1 istek/sn, 429'da `Retry-After`. Aylık çalıştırılır; zincir ayrıca `wd-*` katman QID'lerini xref'e yazar, `link` ile QID bağlarını yeniler ve ISO 3166-2 kodlarını (P300) ekler (ilk tam çalıştırma ≈ 112 bin sorgu kalemi, birkaç dakika). Wikidata topluluk verisidir (`source_class=community`, CC0); resmi kaynağın alanlarını ezmez, ayrı tabloda tutulur. Ardından `link` QID üzerinden GeoNames↔NUTS↔ulusal bağları ekler.

**İndirme önbelleği ve ham arşiv:** `refresh` her çalıştırmada yayıncıdan güncel veriyi ister ama koşullu GET kullanır (`If-None-Match` / `If-Modified-Since`; `.cache/<ad>.meta.json`): değişmeyen dosya 304 ile önbellekten gelir. Her çalıştırmanın okuduğu gövdeler içerik-adresli olarak `.cache/raw/<sha256>` altında saklanır (yeniden üretilebilirlik: `source_runs.raw_sha256` aynı gövdelerin birleşik özetidir); refresh sonunda en eski dosyalar `RAW_ARCHIVE_MAX_MB` (varsayılan 2048) sınırına kadar silinir.

## Zamanlama (üretim)
Zamanlanmış çalıştırma **üretim ortamında, API'nin yanında** yapılır (veritabanı internete açılmaz; GitHub Actions'ın 6 saat sınırı yok — PL kotası ve Wikidata uzun sürebilir). Tek giriş: `scripts/cron/run-cycle.sh`:

`migrate` → `check:licenses` → `refresh --due` → (ayın 1'i) `enrich:wikidata`, `enrich:cldr`, `link` → `publish` → `digest` → `prune` (eski teslimat/kullanım/çalıştırma kayıtları: 90 gün / 2 yıl / 1 yıl; bekleyen teslimatlar ve her kaynağın son 20 çalıştırması silinmez). Adımlar birbirini durdurmaz; her adımın çıkış kodu toplanır, başarısız adım `NOTIFY_WEBHOOK_URL`'e bildirilir. `flock` ile aynı anda tek döngü. Webhook teslimatını çalışan `serve` süreci yapar (15 sn'de bir; birden çok örnekte bile bir teslimat bir kez gider).

```
# /etc/cron.d/country-info  (günlük 03:17 UTC; ortam değişkenleri /etc/country-info.env)
17 3 * * * app  set -a; . /etc/country-info.env; set +a; /srv/country-info/scripts/cron/run-cycle.sh >> /var/log/country-info-cycle.log 2>&1
```
systemd timer eşdeğeridir. `refresh.yml` artık yalnızca elle tetiklenir (`workflow_dispatch`: `--dry-run`/`check:sources` gibi veritabanı gerektirmeyen denetimler için); zamanlama kaldırıldı. `ci.yml` her push'ta `tsc` + testler.

**Ortam değişkenleri (zincir):** `DATABASE_URL`, `NOTIFY_WEBHOOK_URL` (Slack/Teams uyumlu `{text}`), `MAIL_WEBHOOK_URL` + `MAIL_FROM` (e-posta sağlayıcısı bu URL'nin arkasına bağlanır: `POST {from,to,subject,text}`), `PUBLISH_STORE`/`PUBLISH_DIR`/`PUBLISH_PREFIX`, `S3_*`, `PUBLIC_BASE_URL`, `FILE_SIGNING_SECRET` (fs deposu + birden çok API örneği için zorunlu), `CYCLE_LOCK`.

## Bildirim (operatöre)
`refresh` sonunda tek özet: başarısız kaynak, ilk kez `needs_review` olan (aynı kaynağın ardışık tekrarı bir daha bildirilmez), lisans sayfası değişen, 7 günden fazla gecikmiş/engelli kaynak, **Eylül'den itibaren** bir sonraki yılı kapsamayan tatil ülkeleri (listeli günler — TR Diyanet bayramları vb. — her yıl elle girilir). Sessiz günde mesaj yok. Çıkış kodları: 1 = kaynak(lar) ilgi bekliyor (zaten bildirildi), 2 = çökme. `npm run cli -- notify "metin"` bildirim kanalını dener.

## Müşterilere yayın
1. **Webhook** (`snapshot.completed`, `release.published`, `release.retracted`): müşteri kendi API anahtarıyla abone olur (`POST /v1/webhooks`), kendi teslimat günlüğünü görür, `replay`/`test` yapar. Webhook yalnızca uyandırıcıdır; asıl veri `GET /v1/changes?since=<son to_seq>` ile alınır (kaçırılanları telafi eder).
2. **Dosya paketleri:** `publish` (`commercial` + `full`). Yeni snapshot'lar için delta dosyaları, en yenisi için tam veri; manifest en son yüklenir. Müşteri: `GET /v1/exports/latest` (15 dk'lık imzalı bağlantılar, sha256 ile doğrulanır). `commercial` profil kapıları: kaynak green/amber **ve** `license_changed` değil; yükleme öncesi paket taranır, uygun olmayan kaynak kaydı bulunursa yayın durur.
3. **Sürüm notu / e-posta:** her uygulanan snapshot için `release_notes`; `GET /v1/releases`; abonelere `digest` (haftalık veya anında). Vintage geçişi, silme içeren veya ≥500 kayıtlı güncellemeler "highlight"tır ve hemen gönderilir.
**Geri alma:** `npm run publish -- --rollback <snapshotId>` manifest'i eski tam snapshot'a çevirir, sonrasındakileri `retracted` işaretler (dosyalar kalır; verilmiş bağlantılar 404 vermez), ilgili sürüm notlarını geri çeker ve `release.retracted` gönderir. Kaynak veriyi düzeltince yeni snapshot normal akışla yayınlanır. Not: `/files/` yolu `EXPORT_DIR`'in profilsiz ham dökümünü sunar; müşteri dağıtımı için kullanmayın.

Sıklıklar: GeoNames haftalık; GISCO NUTS/LAU, US, NL yıllık; FR, IT, NO, tatiller aylık. Tatil dosyaları depoda olduğundan (`data/holidays/*.json`) değişiklik commit ile gelir; her yıl Eylül'de bir sonraki yılın listeli günleri (TR Diyanet, ES BOE yıllık takvim) güncellenmelidir.

## Runbook
- **`needs_review`:** `npm run refresh -- --source <id> --dry-run` ve `source_runs.detail` oku. Gerçek bir yeniden yapılanma ise (birleşme, yeni vintage) adaptörde `meta.version`'ı güncelle ve `--force` ile çalıştır; kaynak bozuksa bekle (bozuk veri yazılmaz).
- **Ardıl önerileri:** bir yayında hem silinen hem eklenen birim varsa `refresh` aynı üst birim altında ad benzerliğine göre `review_items` (`field = successor:replaced_by | successor:merged_into`, `b_value.to`, `confidence`) yazar ve sonuç ayrıntısında sayıyı bildirir; `GET /v1/review-items` (admin) ile görünür. Öneriler **hiçbir zaman otomatik uygulanmaz**: admin `POST /v1/review-items/:id/resolve {"action":"accept"|"dismiss"}` ile onaylar (onay `entity_successors` tablosuna yazar, migration 007) veya reddeder; onaylanan ilişki `GET /v1/regions/:id/successors` ile (silinmiş kimlikler için de) okunur.
- **`license_changed`:** yayıncının lisans sayfasını **oku**, `docs/licenses/<id>.md` dossier'ini güncelle, uygunsa `npm run license:ack -- <id>`; uygun değilse kaynağı devre dışı bırak ve müşterilere etki analizi yap.
- **`failed`:** URL/şema değişmiş olabilir; `npm run check:sources` ile yeniden üret, adaptörü düzelt (kontrat testi ekle).
- **İzleme:** `GET /v1/status` → `ok:false` ve `attention[]` (needs_review/failed/license_changed/stale); `open_review_items` ve `open_successor_suggestions` bekleyen inceleme sayısını verir. `GET /v1/sources` kaynak başına `last_checked_at`, `last_changed_at`, `next_due_at`, `stale`.
- **Geri alma:** değişiklik günlüğü (`changes`) önceki/sonraki değerleri tutar; ciddi bir kötü uygulamada veritabanı yedeğinden dönün (günlük `pg_dump` önerilir) ve bozuk kaynağı `--force` ile yeniden çalıştırın.

## Sıra (tam kurulum)
`ingest` (geonames) → `refresh --source gisco-nuts,gisco-lau,nat-*` → `ingest:holidays` → `link` → `export`. `refresh` hepsini kapsar; `link` ve `export` ayrı çalıştırılır.

**Gerçek S3 doğrulaması:** `scripts/dev/s3-e2e.sh` imzayı denetleyen bağımsız bir S3 uygulamasına (moto) karşı `S3Store`'u dener; presigned imza boto3 çıktısıyla aynı ürettiği için doğrulanır. Üretimde ilk yayından önce kendi depolamanıza karşı `npm run publish -- --profile commercial` + `GET /v1/exports/latest` ile bir kez deneyin.
