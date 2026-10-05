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

**Aylık zincir:** `refresh.yml` her ayın 1'inde (ve elle çalıştırmada) `enrich:wikidata`, `enrich:cldr`, `link` çalıştırır; hata bu adımlarda uyarı olarak raporlanır, refresh sonucunu gizlemez.

**Wikidata zenginleştirme:** `enrich:wikidata` `entity_xrefs` (QID; `value` NULL = arandı, tekil eşleşme yok) ve `entity_names` (çok dilli ad) tablolarını doldurur; ≤1 istek/sn, 429'da `Retry-After`. Aylık çalıştırılır. Wikidata topluluk verisidir (`source_class=community`, CC0); resmi kaynağın alanlarını ezmez, ayrı tabloda tutulur. Ardından `link` QID üzerinden GeoNames↔NUTS↔ulusal bağları ekler.

## Zamanlama
`.github/workflows/refresh.yml` günlük çalışır: önce `check:licenses`, sonra `refresh --due`. Gerekli sır: `DATABASE_URL`. `ci.yml` her push'ta `tsc` + testler. Elle tetikleme: Actions → refresh → *Run workflow* (örn. `--source nat-it --force`).

Sıklıklar: GeoNames haftalık; GISCO NUTS/LAU, US, NL yıllık; FR, IT, NO, tatiller aylık. Tatil dosyaları depoda olduğundan (`data/holidays/*.json`) değişiklik commit ile gelir; her yıl Eylül'de bir sonraki yılın listeli günleri (TR Diyanet, ES BOE yıllık takvim) güncellenmelidir.

## Runbook
- **`needs_review`:** `npm run refresh -- --source <id> --dry-run` ve `source_runs.detail` oku. Gerçek bir yeniden yapılanma ise (birleşme, yeni vintage) adaptörde `meta.version`'ı güncelle ve `--force` ile çalıştır; kaynak bozuksa bekle (bozuk veri yazılmaz).
- **Ardıl önerileri:** bir yayında hem silinen hem eklenen birim varsa `refresh` aynı üst birim altında ad benzerliğine göre `review_items` (`field = successor:replaced_by | successor:merged_into`, `b_value.to`, `confidence`) yazar ve sonuç ayrıntısında sayıyı bildirir; `GET /v1/review-items` (admin) ile görünür. Öneriler **hiçbir zaman otomatik uygulanmaz**; gözden geçirip `status` güncelleyin.
- **`license_changed`:** yayıncının lisans sayfasını **oku**, `docs/licenses/<id>.md` dossier'ini güncelle, uygunsa `npm run license:ack -- <id>`; uygun değilse kaynağı devre dışı bırak ve müşterilere etki analizi yap.
- **`failed`:** URL/şema değişmiş olabilir; `npm run check:sources` ile yeniden üret, adaptörü düzelt (kontrat testi ekle).
- **İzleme:** `GET /v1/status` → `ok:false` ve `attention[]` (needs_review/failed/license_changed/stale). `GET /v1/sources` kaynak başına `last_checked_at`, `last_changed_at`, `next_due_at`, `stale`.
- **Geri alma:** değişiklik günlüğü (`changes`) önceki/sonraki değerleri tutar; ciddi bir kötü uygulamada veritabanı yedeğinden dönün (günlük `pg_dump` önerilir) ve bozuk kaynağı `--force` ile yeniden çalıştırın.

## Sıra (tam kurulum)
`ingest` (geonames) → `refresh --source gisco-nuts,gisco-lau,nat-*` → `ingest:holidays` → `link` → `export`. `refresh` hepsini kapsar; `link` ve `export` ayrı çalıştırılır.
