# İlerleme kaydı (oturumlar arası özet)

Son güncelleme: 2026-10-05. Dal: `claude/country-info-mvp` (PR açılmadı). Ayrıntılı kalan işler: `docs/ROADMAP.md`; kaynak durumu: `docs/sources/NATIONAL.md`; lisanslar: `docs/licenses/`; işletim: `docs/OPERATIONS.md`.

## Yapılanlar
**Çekirdek (MVP → Faz 3):** TypeScript/Fastify/PostgreSQL servisi; GeoNames ülke/admin1/admin2/şehir; çok kaynaklı ingest (kaynak başına silme, %5 silme/%50 değişim koruması), snapshot + değişim akışı (`/v1/changes`), imzalı webhook, dosya dışa aktarımı (`export`, `--commercial`); provenance (`sources`, atıf, `/v1/sources`, `/v1/status`); `refresh` altyapısı (ham girdi özeti, satır bandı, vintage, lisans sayfası izleme, advisory lock, GitHub Actions).

**Resmî idari bölünmeler (division):** Eurostat NUTS (1.620) ve LAU (🔴 ticari pakette yok); ulusal adaptörler — US, FR (INSEE), IT, NL, NO, SE, CZ, DE, AT, CA, CH, AU, GB (ONS), ES (INE), PT (DGT, yalnız kıta), JP (MIC), PL (GUS BDL), LV (CSB), SI (SURS), HU (KSH), GR (ELSTAT; yeni `.xls` okuyucu). Hepsinin lisans dossier'i `docs/licenses/` altında.

**Topluluk katmanı (CC0, sayı kapılı):** Wikidata bölünmeleri DK, FI, BE, BR, IN (eyalet), BG, SK, LU, RO, LT, EE (`wd-*`); Wikidata QID/çok dilli ad zenginleştirme + QID ile bağlama; CLDR ülke adları (29 dil) + para birimi.

**Tatiller (28 ülke dosyası):** resmî kaynaktan kural motoru; FR, NL (2026-10-05, metinler yeniden okundu), BG/RO/CY eklendi — BG tümüyle, CY çoğunlukla `unverified`, RO 2023 konsolide metne dayanıyor.

**Model/ürün:** `source_class` (official/community), `?official_only`, `sources.priority` + `?canonical=true`, ülke/bölge yanıtında `names`/`xrefs`/`links`, ardıl önerileri (`replaced_by`/`merged_into` → `review_items`, admin onayıyla `entity_successors`, `/v1/regions/:id/successors`), koşullu GET + ham arşiv, OpenAPI (`/openapi.json`, rota-eşleşme testi), API anahtarı + hız sınırı, webhook yükünde `source_ids`/`vintage`/`reason`, TypeScript (`src/sdk.ts`) ve Python (`sdk/python`) istemcileri, veritabanı API anahtarları + kullanım ölçümü + paylaşımlı hız sınırlayıcı, aylık Wikidata/CLDR/link zinciri (workflow; ISO 3166-2 kodları, katman QID bağları: 10.580 `wikidata_qid` bağı), `scripts/pg-start.sh`.

**Güncelleme ve müşteri yayını (2026-10-05, plan: `/root/.claude/plans/kaynak-tarama-ve-musteri-yayini.md`):** üretim zamanlaması `scripts/cron/run-cycle.sh` (migrate → lisans izleme → refresh → aylık enrich → publish → digest; flock, adım başına çıkış kodu); operatör bildirimi `src/notify.ts` (`NOTIFY_WEBHOOK_URL`; tekrarsız needs_review, gecikmiş/engelli kaynak, Eylül'den itibaren eksik tatil yılı); müşteri webhook'ları API anahtarına bağlı (`events`/`countries`/`kinds`, teslimat günlüğü, `replay`, `test`, atomik kiralama ile çift teslimat yok; migration 011); sürüm notları (`release_notes`, `/v1/releases`, `release.published`/`release.retracted`) ve e-posta özeti (`release_subscribers`, `digest`, `MAIL_WEBHOOK_URL`; migration 012); dosya paketleri `publish` (commercial/full profil, her snapshot için delta, manifest en son, yükleme öncesi 🔴 taraması, `license_changed` kaynak dışarıda, geri alma) + S3 (SigV4, AWS vektörüyle doğrulandı) ve yerel imzalı `/dl` depoları, `GET /v1/exports/latest` (anahtarın `export_profile`'ı). Gerçek veriyle denendi: commercial 60 MB / full 83 MB, ikinci çalıştırma "nothing new".

**PT (2026-10-05):** Açores/Madeira eklendi (GeoPackage, `src/sources/gpkg.ts`, `node:sqlite` → Node ≥22.13): nat-pt 3.596 kayıt (29 distrito+ada / 308 município / 3.259 freguesia), ikinci çalıştırma unchanged.

**Bu oturumun (2026-10-05, Faz 7) ek işleri:** S3 deposu bağımsız bir S3 uygulamasına (moto, imza denetimli) karşı doğrulandı (`scripts/dev/s3-e2e.sh`); `run-cycle.sh` bayrakları + kabuk testleri; SDK'larda webhook/release/export/`verifyWebhook`; `prune` bakımı ve `/v1/status` inceleme sayıları; ülke bazlı dosya paketleri (`by-country/<CC>/…`, `api_keys.export_countries`, migration 013); Atom akışı `/v1/releases.atom`; tatil motorunda `substitute` (hafta sonu devri → `data.observed`), `if_weekday` (koşullu kural) ve `hours` (yarım gün); PT Açores/Madeira; **TR tatilleri doğrulandı** (2429 sayılı Kanun metni mevzuat.gov.tr'den ve Diyanet «Dini Günler» tabloları 2024–2026 okundu; 2027–2028 dini bayramlar tentative); `refresh` artık başka kaynağın birimlerine bağlı kayıtları (bölgesel tatiller → `div:FR:dep-57`) hiyerarşi hatası saymıyor (bu hata aylık `official-holidays` yenilemesini `needs_review`'a düşürüyordu).

**Erişim notu (2026-10-05):** konteynerden artık açılanlar: mevzuat.gov.tr, vakithesaplama.diyanet.gov.tr, tuik.gov.tr, cylaw.org, resmigazete.gov.tr, data.gov.hr, dzs.gov.hr; hâlâ kapalı: lex.bg (403), justice.government.bg, legislatie.just.ro, insse.ro, data.gov.ro, data.gov.tr, adres.nvi.gov.tr, nso.gov.mt (403), osp.stat.gov.lt (403), mlsi/gov.cy/pio.gov.cy (403).

**HR bulgusu:** Adalet ve Yönetim Bakanlığı «Popis županija, gradova i općina» (data.gov.hr, XLS: 21 županija [Zagreb dahil] + 428 općina + 128 grad = 556 satır, ad + tür, resmî kod yok; dosya 2013 tarihli ama sayılar bakanlığın güncel beyanıyla uyumlu). **Yüklenmedi:** data.gov.hr «Otvorena dozvola (OD)» lisansının metni okunamadı (portal SPA, metin sunmuyor). Lisans metni okunursa adaptör ~1 saatlik iştir (`readXls` hazır; kimlikler ad tabanlı olur).

**KR/IN bulgusu:** KR için Wikidata sınıfları dağınık (17 üst birim → 16, si-gun-gu → 208 ≠ 226); IN ilçe için doğrulanabilir resmî sayı yok (Wikidata 798) → ikisi de yüklenmedi.

**Sayılar (dev DB):** 133 test yeşil; AB27 LAU yerine kapsam 23/27 (18 resmî + 5 Wikidata).

## Bilinçli olarak yüklenmeyenler
EE (CC BY-SA), HR (resmî kod yok), SK (DATAcube kapandı, sayı uzlaşmıyor), RO/LT/MT (konteynerden erişilemedi), LU (yayıncı lisansı okunamadı), IE (kod/üst birim yok), CY (2024 öncesi liste); TR il/ilçe GeoNames+İBBS (TÜİK/NVİ kapalı), mahalle/sokak yok; KR; PL dışı Wikidata sayı uyuşmazlıkları. Ayrıntı: NATIONAL.md.

## Çalışma kuralları (özet)
Veri eklemeden önce lisans yayıncının sayfasından okunur; `verified` tatil yalnızca okunan resmî metinle; alt-ajan raporları veri sayılır, alıntılar yeniden doğrulanır; yeşil/sarı olmayan kaynak ticari pakete girmez; her adım commit + push, PR yalnızca istenirse. Yeni planlar `/root/.claude/plans/` altında **yeni dosya** olarak yazılır (eski plan dosyası Faz 1–6'yı içerir).

## Kalan işler (2026-10-05 sonu) — hepsi dış engele veya iş/hukuk kararına bağlı
- **Erişim gerektirenler:** BG/RO/CY tatil doğrulaması (lex.bg 403, justice.government.bg, legislatie.just.ro; CY için kamu tatili listesi yasası bulunamadı), TR il/ilçe kodları (TÜİK 🔴 lisans; NVİ/data.gov.tr kapalı), RO/MT/LT resmî kaynakları. TR resmî tatil verisi artık doğrulandı (yalnızca idari izin/köprü günleri yok).
- **Lisans/hukuk kararı:** EE resmî EHAK (CC BY-SA), LAU'nun tamamen kaldırılması (4 AB ülkesi — CY, HR, IE, MT — resmî/doğrulanmış kaynaksız), CC BY-IGO/CLDR kökeni, ES belediye adları (REL), ticari lansman öncesi avukat onayı, ToS/DPA/SLA, fiyatlandırma.
- **Veri:** KR (Wikidata sınıfları dağınık: 17 üst birim için 16, si-gun-gu için 208 ≠ 226; eşleme için resmî liste gerekir), HR resmî kodları, IN ilçeleri, posta kodları ve mahalle/sokak (hacim + KVKK/GDPR + posta lisansları), OSM (ODbL kararı).
- **Ürün:** planlar/kota tabloları ve faturalama entegrasyonu.
- **Güncelleme/yayın kalanları (kod, engelsiz):** gerçek bir S3/MinIO ile uçtan uca deneme (yalnızca sahte sunucuyla test edildi), e-posta sağlayıcısını `MAIL_WEBHOOK_URL` arkasına bağlama, müşteri başına ülke filtreli paketler, Atom/RSS sürüm akışı, TS/Python SDK'da webhook/release/export yöntemleri, `run-cycle.sh` için bir kuru koşu CI testi. Üretim cron'unu kurmak operasyon işidir (docs/OPERATIONS.md).
Konteyner dışı bir ağdan veya kullanıcı kararıyla ilerlenebilir; ayrıntı `docs/ROADMAP.md`.
