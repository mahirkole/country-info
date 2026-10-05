# İlerleme kaydı (oturumlar arası özet)

Son güncelleme: 2026-10-05. Dal: `claude/country-info-mvp` (PR açılmadı). Ayrıntılı kalan işler: `docs/ROADMAP.md`; kaynak durumu: `docs/sources/NATIONAL.md`; lisanslar: `docs/licenses/`; işletim: `docs/OPERATIONS.md`.

## Yapılanlar
**Çekirdek (MVP → Faz 3):** TypeScript/Fastify/PostgreSQL servisi; GeoNames ülke/admin1/admin2/şehir; çok kaynaklı ingest (kaynak başına silme, %5 silme/%50 değişim koruması), snapshot + değişim akışı (`/v1/changes`), imzalı webhook, dosya dışa aktarımı (`export`, `--commercial`); provenance (`sources`, atıf, `/v1/sources`, `/v1/status`); `refresh` altyapısı (ham girdi özeti, satır bandı, vintage, lisans sayfası izleme, advisory lock, GitHub Actions).

**Resmî idari bölünmeler (division):** Eurostat NUTS (1.620) ve LAU (🔴 ticari pakette yok); ulusal adaptörler — US, FR (INSEE), IT, NL, NO, SE, CZ, DE, AT, CA, CH, AU, GB (ONS), ES (INE), PT (DGT, yalnız kıta), JP (MIC), PL (GUS BDL), LV (CSB), SI (SURS), HU (KSH), GR (ELSTAT; yeni `.xls` okuyucu). Hepsinin lisans dossier'i `docs/licenses/` altında.

**Topluluk katmanı (CC0, sayı kapılı):** Wikidata bölünmeleri DK, FI, BE, BR, IN (eyalet), BG, SK, LU, RO (`wd-*`); Wikidata QID/çok dilli ad zenginleştirme + QID ile bağlama; CLDR ülke adları (29 dil) + para birimi.

**Tatiller (28 ülke dosyası):** resmî kaynaktan kural motoru; FR, NL (2026-10-05, metinler yeniden okundu), BG/RO/CY eklendi — BG tümüyle, CY çoğunlukla `unverified`, RO 2023 konsolide metne dayanıyor.

**Model/ürün:** `source_class` (official/community), `?official_only`, `sources.priority` + `?canonical=true`, ülke/bölge yanıtında `names`/`xrefs`/`links`, ardıl önerileri (`replaced_by`/`merged_into` → `review_items`, admin onayıyla `entity_successors`, `/v1/regions/:id/successors`), koşullu GET + ham arşiv, OpenAPI (`/openapi.json`, rota-eşleşme testi), API anahtarı + hız sınırı, webhook yükünde `source_ids`/`vintage`/`reason`, TypeScript istemcisi (`src/sdk.ts`), aylık Wikidata/CLDR/link zinciri (workflow), `scripts/pg-start.sh`.

**Sayılar (dev DB):** 112 test yeşil; AB27 LAU yerine kapsam 21/27 (18 resmî + 3 Wikidata).

## Bilinçli olarak yüklenmeyenler
EE (CC BY-SA), HR (resmî kod yok), SK (DATAcube kapandı, sayı uzlaşmıyor), RO/LT/MT (konteynerden erişilemedi), LU (yayıncı lisansı okunamadı), IE (kod/üst birim yok), CY (2024 öncesi liste); TR il/ilçe GeoNames+İBBS (TÜİK/NVİ kapalı), mahalle/sokak yok; KR; PL dışı Wikidata sayı uyuşmazlıkları. Ayrıntı: NATIONAL.md.

## Çalışma kuralları (özet)
Veri eklemeden önce lisans yayıncının sayfasından okunur; `verified` tatil yalnızca okunan resmî metinle; alt-ajan raporları veri sayılır, alıntılar yeniden doğrulanır; yeşil/sarı olmayan kaynak ticari pakete girmez; her adım commit + push, PR yalnızca istenirse. Yeni planlar `/root/.claude/plans/` altında **yeni dosya** olarak yazılır (eski plan dosyası Faz 1–6'yı içerir).
