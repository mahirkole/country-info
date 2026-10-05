> Bu belge `docs/ROADMAP.md`'nin ayrıntılı plan dizisidir (2026-10-04). Uygulanan her fazı burada işaretleyin; kısa durum özeti `docs/ROADMAP.md`'dedir.
> **Uygulama durumu (2026-10-04):** Faz 3-A temel altyapı **uygulandı** (migration 004, `src/refresh.ts`, `src/targets.ts`, `src/license-watch.ts`, `/v1/status`, CI ve refresh iş akışları, `docs/OPERATIONS.md`). Eksik 3-A maddeleri: ETag/Last-Modified koşullu indirme, ham indirme arşivi, `replaced_by` ardıl ilişkileri (sürüm-geçişi etiketi var), tatil yıllık kontrol betiği. 3-B: şablon hazır; ilk 6 dossier (geonames, gisco-nuts, gisco-lau, nat-us, un-m49, iana-tld) bağımsız ikinci geçişten geçti ve `docs/licenses/`'e alındı; **LAU ve BM M49 🔴**; `export --commercial` profili ve `DISABLE_SOURCES` eklendi; diğer dossier'ler sürüyor. Yazışma listesi: `docs/licenses/OUTREACH.md`.

# Faz 3 — Geniş kapsamlı plan dizisi (güncelleme + lisans/satış uygunluğu merkezde)

## Context
Çerçeve ve ilk kaynaklar hazır: GeoNames (topluluk), Eurostat NUTS/LAU, ulusal adaptörler (US, FR, IT, NL, NO), 23 ülke tatil dosyası, `division` modeli, `sources`/atıf/`/v1/sources`, lisans durumu (`read|partial|unread`). Kullanıcının yeni şartları:
1. **Resmi kaynakların güncellenmesi** baştan tasarlanmalı (bugün hepsi elle çalıştırılan tek seferlik ingest).
2. **Her kaynak için** lisans, ticari kullanım, **bilgiyi satma** koşulları kesinlikle araştırılıp **not edilmeli**; belirsiz kaynaktan veri alınmaz.
Bu bölüm kalan her şeyi, bağımlılık sırasıyla, doğrulanabilir çıkış ölçütleriyle faz faz sıralar. Her faz bağımsız commit/push edilir; PR yalnızca istenirse.

## Bu oturumda toplanan ön lisans bulguları (salt okunur, 2026-10-04; sayfa metni okundu, hukuki görüş değildir)
| Kaynak | Okunan ifade (özet) | Ticari kullanım / satış | Dikkat |
|---|---|---|---|
| GB – ONS (Open Geography) | ONS lisans sayfası: "Open Government Licence… use or re-use ONS material, **whether commercially or privately**… freely without a specific application", ONS kaynak gösterimi şart | **Evet** (OGL) | "Ürünler **başka kurumların IPR'ını** içerebilir" (Royal Mail posta kodu, Ordnance Survey) → ürün bazında ayrı kontrol; posta kodu verisi riskli |
| AU – ABS | "All material… provided under **CC BY 4.0**", istisnalar: arma, ABS logosu, mikrodata, üçüncü taraf içerik | **Evet** (CC BY) | İstisna listesi veri setine göre kontrol |
| DE – dl-de/by-2.0 (Datenlizenz Deutschland) | "Jede Nutzung zulässig… **kommerzielle** und nicht kommerzielle… Dritten übermittelt" | **Evet**, atıf şartı | Lisans veri setine bağlı (Destatis/BKG her set için ayrı); Länder verileri farklı olabilir |
| CA – Statistics Canada | `statcan.gc.ca/en/reference/licence` erişilebilir (Open Licence sayfası) | Metin henüz ayrıntılı okunmadı | Ana sayfa 403 veriyor ama lisans sayfası 200 |
| SE – SCB | "open data is available for everyone to use **free of charge**" | Lisans adı/atıf şartı bulunamadı | Hangi lisans (CC0/CC BY?) açıkça okunmalı |
| ES – INE | Hukuki uyarı "Reutilización de la información…" bölümüne atıf yapıyor; kullanım "bajo su propia cuenta y riesgo" | Bölüm henüz okunmadı | Yeniden kullanım şartları ayrıca okunacak |
| IT – ISTAT | CC BY 4.0 (okundu) | Evet | Atıf |
| NL – CBS | Web sitesi CC BY 4.0 (okundu); OData tablosuna ayrı metin yok | Büyük olasılıkla evet | partial |
| FR / NO / US | partial (bkz. `docs/LICENSES.md`) | Büyük olasılıkla evet | Metin teyidi |
| CH – BFS | opendata.swiss 4 şart: OPEN / BY / **ASK (ticari kullanım için izin gerekir)** / BY ASK; BFS paketinde hangisi olduğu okunamadı | **Bilinmiyor → alınmaz** | Yazılı teyit |
| EU – Eurostat | "commercial or non-commercial reuse authorised provided the source is acknowledged"; "başka kaynaklara ait veri" istisnası | Evet | LAU nüfus/alan ulusal kaynaklı olabilir |
| GeoNames | CC BY 4.0 (readme), "commercial usage is allowed" | Evet (🟡) | Resmi değil; 100+ üst kaynak, birçoğunun lisansı listede yok |
| **GISCO LAU (dossier sonucu)** | "specific download rules… must be complied with", metin okunamadı | **🔴 satılmaz** | Eurostat/EuroGeographics yazılı teyit |
| **BM M49 (dossier sonucu)** | "personal, non-commercial use, without any right to resell or redistribute… derivative works" | **🔴 satılmaz** | Yazılı izin |
| JP, AT, FI, PL, DK, TR | Tahmin ettiğim lisans URL'leri 404/erişilemedi | Bilinmiyor | URL'ler araştırılacak |

## Faz 3-A — Güncelleme (refresh) altyapısı  *(önce bu; her kaynak buna bağlanır)*
Sorun: bugün ingest elle ve kaynaktan bağımsız; kaynaklar farklı hızlarda değişir (günlük/aylık/yıllık/olay bazlı), sürümler (NUTS 2024→sonraki, LAU yıllık, INSEE COG yıllık, CBS tablo no. yıllık değişir), URL'ler ve şemalar bozulur, lisanslar değişir.
1. **Kaynak metaverisi:** `NationalSource` ve tüm kaynaklara `refresh: { cadence: 'daily'|'weekly'|'monthly'|'annual'|'event', expectedRows: [min,max], lastKnownVintage, checkUrl }`. `sources` tablosuna: `cadence, last_checked_at, last_changed_at, content_sha256, vintage, next_due_at, status` (migration 004).
2. **Koşullu indirme ve değişim tespiti:** `fetchText/fetchBytes` ETag/Last-Modified + ham içerik sha256 kaydeder; hash aynıysa ingest atlanır (`unchanged_source`). Ham indirmeler içerik-adresli arşivde saklanır (`.cache/raw/<sha256>`) → yeniden üretilebilirlik, delta nedeni kanıtı.
3. **`source_runs` tablosu** (source_id, started/finished, status, rows, inserted/updated/deleted, error, raw_sha256) ve `npm run refresh [--due|--source <id>]`; çıkış kodları CI/cron için. Çalıştırma başına kilit (advisory lock) — aynı kaynak iki kez çalışmaz.
4. **Güvenlik bantları:** satır sayısı bandı (`expectedRows`), mevcut silme koruması (%5) + yeni "değişim oranı" koruması; aşılırsa otomatik uygulanmaz, `review_items`/`source_runs.status='needs_review'` olur ve kullanıcıya bildirilir.
5. **Sürüm geçişleri (vintage):** yıllık yeniden yayımlar normal güncellemeden ayrı işlenir (`version` değişti → "release" işareti, delta'ya `reason: vintage_change`), birleşme/bölünme/ad değişimi için **ardıl ilişkisi** (`entity_links.relation = 'replaced_by' | 'split_from'`) — BFS Mutationen, INSEE COG olayları, Resmî Gazete kararları bu ilişkiyi besler; böylece "sil+ekle" yerine anlamlı delta çıkar.
6. **Şema/URL bozulması:** her adaptör için "kontrat testi" (başlık/alan varlığı, örnek kayıt) canlı çalıştırılır (`npm run check:sources`); bozulursa refresh durur ve uyarır.
7. **Lisans kayması izleme:** her kaynağın lisans sayfasının metin hash'i saklanır; `check:licenses` günlük karşılaştırır; değişirse kaynak `status='license_changed'` olur, ingest durur (Faz 3-B kanıt arşiviyle bağlantılı).
8. **Zamanlayıcı ve operasyon:** GitHub Actions `schedule` (günlük "due" kaynak taraması) + manuel `workflow_dispatch`; Postgres servis konteyneri ile test; sonuç özeti; başarısızlıkta issue/bildirim. `docs/OPERATIONS.md`: sıra (geonames → ulusal → gisco → tatiller → link → export), yedek, geri alma.
9. **Güncellik API'si:** `/v1/sources` yanıtına `cadence, last_checked_at, last_changed_at, next_due_at, stale` ve `/v1/status`; müşteri webhook'u `snapshot.completed`'a `source_ids`, `vintage` ekler.
10. **Tatil yıllık döngüsü:** her yıl Eylül'de "gelecek yıl listeli günler" kontrolü (TR Diyanet bayramları, ES BOE yıllık takvim, resmi duyurular); `coverage` uyarısı; `tentative → verified` geçişi delta olarak görünür.
Çıkış ölçütü: `npm run refresh --due` tüm yüklü kaynakları çalıştırır; değişmeyen kaynak 0 DB yazımıyla biter; bozuk/kesik kaynak dalgası geri alınır; testler: hash-atla, band ihlali, vintage geçişi, ardıl ilişkisi.

## Faz 3-B — Lisans / ticari kullanım / satış uygunluğu araştırma programı  *(3-A ile paralel, her yeni kaynağın önkoşulu)*
**Kaynak dosyası (dossier) şablonu** — `docs/licenses/<source-id>.md`, her kaynak için zorunlu alanlar (hepsi kaynak sayfasından **okunarak**, alıntı + URL + okuma tarihi + sayfa hash'i):
1. Yayıncı ve veri seti, lisans adı/sürümü ve **lisans metninin URL'si**
2. **Ticari kullanım** serbest mi? 3. **Ham veriyi yeniden dağıtma** (dump satışı) 4. **Türetilmiş veritabanı / API satışı** 5. **Müşteriye alt-lisans** (müşteri yeniden dağıtabilir mi?)
6. Atıf metni ve biçimi 7. **Share-alike / viral** (ODbL, CC BY-SA) 8. **Non-commercial / ASK** şartı 9. Üçüncü taraf IP istisnaları (Royal Mail, OS, EuroGeographics…) 10. Marka/logo ve "kurum onaylıyor izlenimi verme" yasağı
11. ToS: otomatik indirme/API hız limiti, kimlik doğrulama 12. Veritabanı hakkı (AB sui generis) ve ülke özgü kısıtlar 13. Kişisel veri (adres/bina düzeyi; KVKK/GDPR) 14. Garanti reddi 15. **Şart değişikliği hakkı / sürüm** (lisans kayması) 16. Yaptırım/ihracat kısıtı olan ülkeler
17. Karar: 🟢 satışa uygun · 🟡 şartlı (atıf/SA/teyit) · 🔴 uygun değil/bilinmiyor · ⚪ okunamadı; **gerekçe + kim/ne zaman**
**Süreç:** (a) Ülke grubu başına araştırma ajanları (önceki turdaki gibi, katı protokol: yalnızca okunan metin alıntılanır); (b) **bağımsız ikinci geçiş** — URL'ler yeniden çekilip alıntılar kaynakta aranır (tatillerde yapılan yöntem); (c) yayıncıya e-posta ile yazılı teyit gereken kaynaklar listesi (`docs/licenses/OUTREACH.md`: ASK/belirsiz olanlar, örn. BFS, TÜİK, NVİ, PTT, bazı INSEE/CBS metinleri); (d) lisans sayfası anlık görüntüsü + hash arşivi (3-A madde 7'ye girdi).
**Sözleşme/ürün tarafı:** müşteri sözleşmesinde "veri 'olduğu gibi'", sorumluluk sınırı, atıf yükümlülüğü aktarımı, kaynak sınıfına göre paket (🟢 standart paket; 🟡 ayrı bayraklı; SA/ASK dışarıda), düzeltme/itiraz süreci.
Çıkış ölçütü: yüklü her kaynakta (geonames, gisco-nuts, gisco-lau, nat-us/fr/it/nl/no, official-holidays) tam dossier; `licenseStatus: partial` olanlar ya `read`'e yükseltilir ya da OUTREACH listesine girer; `/v1/sources` her kaynak için `license_verdict` ve `commercial_use` alanlarını gösterir; "yalnızca 🟢" export profili çalışır.

## Faz 3-C — Ulusal bölünmeler: dalgalar (her ülke: dossier → adaptör → test → refresh meta → NATIONAL.md)
Her ülke için işlem sırası değişmez: lisans dossier'i (3-B) → yalnızca 🟢/🟡 ise adaptör. Hiyerarşi, yerel tür adları (`type_local`) ve hacim notu dossier'e yazılır.
- **Dalga 1 (açık lisans, erişilebilir):** SE (SCB), GB (ONS; posta kodu dosyaları hariç), AU (ABS ASGS), DE (Destatis/BKG GV100AD, dl-de/by-2.0 — veri seti bazlı doğrula), AT (Statistik Austria / BEV; doğru URL bul), BE (Statbel), FI (Tilastokeskus), DK (Dataforsyningen yeni API; DAWA kapandı), ES (INE/CNIG), PT (INE/CAOP-DGT), PL (GUS TERYT), IE (CSO), CZ (ČÚZK/ČSÚ), SK, HU (KSH), RO, BG, HR, SI, EE, LV, LT, LU, MT, CY, GR → **AB27 tamamlanır; NUTS/LAU ile `entity_links`** (İtalya CSV'sindeki NUTS kodu gibi hazır kodlar doğrudan bağ).
- **Dalga 2 (büyük ekonomiler, çeşitli biçimler):** JP (MIC xlsx; xlsx ayrıştırıcı), KR (KOSTAT/MOIS), IN (LGD / Census), BR (IBGE API), MX (INEGI), AR (INDEC/IGN), CL, CO (DANE DIVIPOLA), CA (StatCan Open Licence — erişim yolu), NZ (Stats NZ), ZA (Stats SA / MDB), ID (BPS/Kemendagri), RU (Rosstat OKTMO — yaptırım/ToS kontrolü), UA, IL (CBS), SA, AE, EG, NG, KE, CN (NBS 统计用区划代码 — NBS koşulları), CH (BFS lisansı teyit edilirse).
- **Dalga 3 (Türkiye, kullanıcı ağı gerekir):** TÜİK il/ilçe/İBBS; NVİ UAVT/MAKS (mahalle, köy, sokak, bina; erişim izni + KVKK değerlendirmesi); Resmî Gazete idari değişiklik izleyici (olay → `replaced_by`, `review_items`).
- **Dalga 4 (çok uluslu resmi katman) — DİKKAT: UN M49/UNSD 🔴 (BM şartları: kişisel/ticari olmayan kullanım, yeniden satış ve türev yok; yazılı izin gerekir) → izin gelmeden kullanılmaz;** UN SALB, **UN OCHA COD-AB** (ülke bazlı admin1–3; lisans CC BY-IGO mu okunacak), IANA (TLD), ITU E.164, UPU posta biçimleri, SIX ISO 4217 → GeoNames ülke niteliklerinin (para birimi, telefon, TLD, posta biçimi, diller, M49, BM üyeliği) **resmi kaynaklarla değiştirilmesi**; BM üye/gözlemci listesi BM sitesinden okunarak (un.org 403 → UNSD M49 / alternatif) doğrulanır. Diller için tek resmi küresel kaynak yok → ülke anayasası/resmi dil mevzuatı (tatil yöntemiyle) veya alan boş.
- **Dalga 5 (alt seviyeler ve adresler):** mahalle, sokak, bina, posta kodu — ülke adres kayıtları (NL BAG, FR BAN, DK Dataforsyningen, NO Matrikkel/Adresser, FI Digiroad/DVV, CH amtl. Strassenverzeichnis, AT BEV Adressregister, BE BeSt, PL PRG/TERYT, IT ANNCSU, ES CNIG, US TIGER/NAD). Ayrı kapılar: **hacim** (on milyonlarca kayıt → bölümlü tablo/ayrı depolama, `entities` şişmesin), **kişisel veri** (adres+kişi bağı yok; yine de KVKK/GDPR hukuki değerlendirme), **posta kodu lisansları** (Royal Mail PAF, PTT, Deutsche Post vb. sınırlı → atlanır veya açık alternatif). OSM yalnızca ODbL share-alike kararı verildikten sonra.
Her dalga için çıkış ölçütü: ülke sayısı, birim sayıları resmi rakamlarla örtüşür (İtalya 20/107/7.896 örneği gibi), ikinci çalıştırma `unchanged`, kontrat testi, refresh kaydı, dossier 🟢/🟡.

## Faz 3-D — Resmi tatiller: tamamlama ve sürekli bakım
1. Eksik dosyalar: BG, RO (erişim: alternatif resmi host), FR, NL, CY (resmi liste); sonra G20/AB dışı ülkeler (resmi gazete/mevzuat).
2. `unverified` → `verified`: BE, LU, FI, GR, LT, MT, SI (güncel konsolide metin), DE eyalet yasaları (bölgesel günler `region: nuts:DEx`), IT Legge 260/1949, DK birincil hüküm, PT 2013 öncesi, SK 17 Kasım 2024, TR (Diyanet/mevzuat — kullanıcı ağı).
3. Motor genişlemeleri: koşullu kurallar (IE St Brigid's Day), hafta sonu devri (LV/ES/GB "substitute day"), yarım gün, bölgesel/yerel kapsam, **hicri takvim listeleri** (resmi duyuru kaynağı: Diyanet, Suudi Umm al-Qura, Hindistan gazetesi…), `region` için `div:*`/`nuts:*` bağları.
4. Yıllık bakım: 3-A madde 10; ajan-okuma + bağımsız doğrulama yöntemi tekrarlanır; Nager.Date yalnızca alarm.
5. Lisans: her ülkenin mevzuat/duyuru yeniden kullanım şartı dossier'e (çoğu mevzuat telif dışı/kamusal; teyit edilir).

## Faz 3-E — Kalite, eşleme ve model
1. **entity_links:** GeoNames ↔ NUTS ↔ ulusal `div:*` (resmi kodlar, İtalya NUTS kodu, ISO 3166-2); `alternateNamesV2` veya ISO 3166-2 ile eşleşme %22 → hedef ≥%80 (admin1); belirsizler `review_items`.
2. **ISO 3166-2**, çok dilli adlar (ulusal kaynaklardaki resmi adlar öncelikli; ör. İtalya `name_other`, İsviçre dört dil), kararlı kimlikler ve **ardıllık**.
3. **Kaynak öncelik/birleştirme:** alan bazlı öncelik kuralları (resmi > topluluk), `source_class` (`official|community|unverified`), `?official_only=true`, ulusal kaynağı olan ülkede GeoNames katmanını gizleme/devre dışı bırakma seçeneği, "yalnızca resmi" export profili.
4. **Kalite panoları:** kaynak başına sayım vs resmi istatistik, hiyerarşi bütünlüğü (yetim kayıt yok), ad çakışmaları; regresyon için "altın sayılar" testleri.

## Faz 3-F — Ürün, dağıtım ve ticari hazırlık
1. API anahtarı, hız sınırı, OpenAPI şeması, SDK'lar (TS/Python), sürümleme ve kırıcı değişiklik politikası, durum sayfası.
2. Dağıtım: `ATTRIBUTION.md` + `/v1/sources` + yanıt başlığı; müşteri başına atıf paketi; lisans profili (🟢/🟡) export.
3. Webhook'lar: `kinds`, `source_ids`, `vintage`; delta dosyaları; abonelik başına ülke/seviye filtresi.
4. Hukuk: sözleşme şablonları (ToS, DPA, SLA, sorumluluk sınırı, düzeltme süreci), ihtilaflı bölge politikası, **avukat onayı kapısı** (ticari lansman öncesi zorunlu), OUTREACH yanıtları.
5. Fiyatlandırma ve segment doğrulaması: önceki konuşmadaki 5–10 müşteri görüşmesi; ücretsiz (ülke+admin1), ücretli (delta/webhook, tatiller, SLA).

## Bağımlılık ve sıra
`3-A (refresh) ∥ 3-B (lisans programı)` → `3-C Dalga 1` (3-B kapısından geçenler) → `3-D` (paralel) → `3-E` → `3-C Dalga 4` (GeoNames niteliklerini değiştirme) → `3-C Dalga 2/3` → `3-C Dalga 5` → `3-F`. Dalga 3 (TR) ve OUTREACH kalemleri kullanıcı ağı/yazışması gerektirir; engellenirse diğer dalgalar durmaz.

## Kritik dosyalar
Değişecek: `src/ingest.ts` (değişim oranı koruması, `source_runs`), `src/cli.ts` (`refresh`, `check:sources`, `check:licenses`), `src/sources/fetch.ts` (ETag/hash/arşiv; curl yedeği zaten var), `src/sources/national/types.ts` (`refresh`, `licenseVerdict`, `commercialUse`), `src/api.ts` (`/v1/sources` genişlemesi, `/v1/status`, `official_only`), `src/linking.ts`, `docs/LICENSES.md`, `docs/sources/NATIONAL.md`, `docs/ROADMAP.md`.
Yeni: `migrations/004_refresh.sql`, `src/refresh.ts`, `src/license-watch.ts`, `docs/licenses/<source-id>.md` (+ `TEMPLATE.md`, `OUTREACH.md`), `docs/OPERATIONS.md`, `.github/workflows/refresh.yml` (+ `ci.yml`), `src/sources/national/<cc>.ts` (ülke başına), `test/refresh.test.ts`, `test/sources-contract.test.ts`.

## Doğrulama (uçtan uca)
- `npm test` (+ `TEST_DATABASE_URL`), `npx tsc --noEmit -p .`; yeni testler: hash-atla, ETag, band/oran koruması + rollback, vintage geçişi ve `replaced_by`, lisans hash değişimi → ingest durur, `official_only`/profil filtreleri.
- Gerçek veri: `npm run refresh --due` iki kez → ikinci çalıştırma 0 yazım; kaynak sayıları resmi rakamlarla (TR 81/973, IT 20/107/7.896, NO 15/357, NL 4/12/342 …); `/v1/sources` güncellik alanları dolu.
- Lisans dossier'leri: her 🟢/🟡 kayıt için alıntı + URL + hash; **bağımsız ikinci geçiş** betiği alıntıları kaynakta yeniden bulur (tatillerde kullanılan yöntem).
- Her adım sonunda commit + push (`claude/country-info-mvp`); PR yalnızca istenirse.

## Riskler / açık noktalar
- Lisans metni okunamayan kaynaklar (CH, TR kurumları, JP/AT/FI/PL doğru URL'leri) planı yavaşlatır → OUTREACH ile yazılı teyit; okunmayan kaynak **alınmaz**.
- Ticari lansman **avukat onayı olmadan yapılmaz**; bu plandaki lisans notları hukuki görüş değildir.
- Yıllık sürüm geçişleri ve idari birleşmeler büyük delta üretir; müşteri etkisi için "release" sınıfı ve ardıl ilişkisi şart.
- Hacim: sokak/bina seviyesi depolama ve KVKK/GDPR kararı verilmeden Dalga 5 başlamaz.
- Kurum siteleri bu konteynerden kararsız erişiliyor (WAF, proxy); her kaynakta curl yedeği ve yeniden deneme kullanılır, yine de bazıları kullanıcı ağı gerektirir.

> Devamı (Faz 4–6, 2026-10-05 durumu ve kalan işler): `docs/ROADMAP.md` → "Faz 6".
