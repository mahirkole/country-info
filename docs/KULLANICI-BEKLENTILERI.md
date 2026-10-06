# Kullanıcıdan beklenenler (2026-10-06)

Kod tarafında konteynerden yapılabilen işler bitti; aşağıdakiler karar, erişim/ortam veya hukuki/ticari onay gerektirdiği için sizde. Her satır: **neden** sizde ve **olası çözüm**. En kritik üçü: (1) LAU kararı, (2) avukat onayı, (3) engelsiz ağdan veya izin listesiyle erişim.

## 1. Karar bekleyenler

| # | Karar | Neden sizde | Seçenekler (öneri) |
|---|---|---|---|
| 1 | **`gisco-lau` (Eurostat LAU) kaldırılsın mı?** | Lisansı 🔴 (indirme şartları okunamadı), ticari pakete girmiyor. Resmî kaynak kapsamı AB27'de 20/27; kaldırırsanız CY, HR, IE, LT, MT, RO, SK'de belediye düzeyi boşalır. | (a) Şimdilik tut, ticaride zaten dışarıda; (b) kaldır, boşluğu kabul et; (c) kaynaklar açılana kadar bekle. **Öneri: (a).** |
| 2 | **Docker daemon'lu makine** | Bu ortamda imaj derlenemedi, yalnızca `docker compose config` doğrulandı. | Daemon'lu makinede `docker compose up --build` + ilk yükleme (`docs/OPERATIONS.md` "Kurulum"). |
| 3 | **OSM / ODbL** (mahalle, sokak) | ODbL share-alike getirir; veri tabanını açma yükümlülüğü doğabilir. | OSM'i kullanma (öneri) veya ayrı, açık bir katman olarak kullan. |
| 4 | **Posta kodu / sokak / mahalle kapsamı** | Hacim (on milyonlarca kayıt), KVKK/GDPR, ülke bazlı posta kodu lisansları. | Kapsam dışı bırak (öneri) veya ülke seçip tek tek lisans oku. |
| 5 | **Fiyat planları ve faturalama** | Kota/plan altyapısı hazır (`plan`, `monthly_quota`); hangi plana kaç istek/fiyat iş kararı. | Ücretsiz (ülke + admin1) / ücretli (delta, webhook, tatiller, SLA) ayrımını belirleyin; plan tablosunu koda dökerim. |
| 6 | **Hedef segment ve müşteri görüşmeleri** | Ürün-pazar uyumu doğrulanmadı. | 5–10 görüşmeyle en çok istenen scope'ları (tatil, para birimi, bölge listesi…) belirleyin. |

## 2. Erişim / ortam gerektirenler

| # | İş | Neden sizde | Çözüm |
|---|---|---|---|
| 7 | **Üretim kurulumu** (cron/compose, `.env`, sırlar) | Sunucu, alan adı ve sırlar sizde. | `docs/OPERATIONS.md` "Kurulum"; `ADMIN_TOKEN`, `FILE_SIGNING_SECRET`, `NOTIFY_WEBHOOK_URL` verin. |
| 8 | **Depolama ve e-posta sağlayıcısı** (S3/CDN, sürüm notu e-postası) | Hesap ve sağlayıcı seçimi sizin. | S3 uyumlu depo (imza kodu moto ile doğrulandı) + JSON webhook alan e-posta servisi; seçince bilgileri verin. |
| 9 | **Engelli resmî siteler** | Bu ortamın proxy'si 403/Cloudflare/politika engeli koyuyor: lex.bg, legilux.public.lu, legislatie.just.ro, insse.ro, nso.gov.mt, osp.stat.gov.lt, data.gov.lt, ejustice.just.fgov.be (captcha), mevzuat.gov.tr (kısmen). | Engeli olmayan bir ağdan aynı depoyla çalıştırın (`docs/ROADMAP.md` sırası) veya siteleri proxy izin listesine ekletin. Açılınca BG, RO, BE, LU, DE, MT, LT tatil doğrulaması ve bölünme kaynağı adımlarını tekrarlarım. |
| 10 | **TR idari birimler** (TÜİK il/ilçe, NVİ adres, PTT posta kodu) | Lisans 🔴 veya erişim kapalı; "izin istemeyeceğiz" kararı gereği alınmıyor. | Lisansı temiz, makinece okunur bir resmî kaynak bulunursa (yönlendirirseniz ararım); yoksa boş kalır. |
| 11 | **`contracts.yml` ilk GitHub Actions çalıştırması** | CI'ya erişimim yok. | Haftalık tetiklenir; ilk sonucu iletin, gürültülü kaynakları ayıklarım. |
| 12 | **SDK yayınlama** (npm / PyPI) | Hesap ve paket adı sizin. | `sdk/ts` ve `sdk/python` hazır; `private: true` ve `UNLICENSED` yer tutucu. Paket adı ve lisansı seçin. |

| 17 | **BE ve LU tatilleri: «resmî bilgi sayfası» `verified` sayılsın mı?** | Yasa metni okunamadı (BE ejustice captcha, LU legilux JS-only); ancak resmî hükümet sayfaları (emploi.belgique.be, guichet.public.lu) 10/11 yasal tatili sayıyor ve yasayı anıyor. Proje kuralı «resmî metin okundu» der. | (a) `unverified` kalsın (öneri, kural lafzı); (b) bu resmî sayfalar yeterli sayılsın, kural metni "resmî metin veya resmî duyuru" olarak genişletilsin. |
| 18 | **TR bölünme: OCHA COD-AB (CC BY-IGO, 81 il + 973 ilçe) yüklensin mi?** | HDX lisansı «even commercially» der, ancak metodoloji notu «shared … for humanitarian use only» (üst kaynak HGK) ve kodlar resmî NVİ kodu değil. Üst hak belirsiz. | (a) yükleme (öneri); (b) `license_verdict: amber` ile yükle; (c) avukat yorumu alınca yükle. |
| 19 | **BG bölünme: NSI EKATTE lisansı «türev ve derleme eser dağıtma» yasağı içeriyor** | API/veri tabanı satışı türev/derleme eser olabilir; lisans EKATTE'yi açıkça adlandırmıyor. | (a) yükleme, Wikidata katmanı kalsın (öneri); (b) avukat yorumu alınırsa EKATTE yüklenir (veri hazır ve doğrulandı: 28 oblast + 265 obshtina). |

## 3. Hukuki / ticari kapı (lansman öncesi zorunlu)

| # | Madde | Neden | Çözüm |
|---|---|---|---|
| 13 | **Avukat onayı** | Lisans notları hukuki görüş değildir. Açık noktalar: ES REL adları, CC BY-IGO (OCHA), CLDR ve BM M.49 kökeni, libphonenumber (Apache-2.0) ve libaddressinput (CC BY 4.0) bildirim yükümlülüğü, PT/GB/JP API lisans cümleleri, EE katman üst verisi ve İstatistik Estonya kökeni. | Avukata `docs/licenses/` dossier'lerini ve `docs/licenses/OUTREACH.md` listesini verin. Yazılı izin istemiyoruz; yalnızca yorum alınır. |
| 14 | **ToS / DPA / SLA, sorumluluk reddi, düzeltme bildirim adresi** | Sözleşme dili şirketiniz adına yazılır. | Avukatla şablon çıkarın; atıf başlıkları ve düzeltme uç noktası gibi teknik kancaları ben eklerim. |
| 15 | **İhtilaflı bölge politikası** (ör. Kıbrıs, Kırım, Kosova) | Siyasi/hukuki tutum sizin. | Kısa bir politika metni yazın; veri etiketlemesini ona göre ayarlarım. |
| 16 | **`export_countries` yalnızca dosya paketlerini sınırlıyor, API'yi sınırlamıyor** | Bilinçli tutarlılık kararı. | Sözleşmede açıkça yazın; isterseniz API'de de uygulanmasını isteyin. |

## 4. Bilgi: sizden bir şey beklemeyenler

- **TLD:** otomatik, ülke eşlemeli, lisansı temiz kaynak yok; GeoNames'te kalıyor.
- **BM gözlemci durumu (VA, PS):** otomatik, lisansı temiz kaynak yok.
- **ES yıllık BOE takvimi:** kararlı makine URL'i yok, yüklenmiyor.
- **TR idari izin günleri:** serbest metin; otomasyon kuralına aykırı.
- **LAU boşlukları (CY, HR, IE, LT, MT, RO, SK):** ayrıntılı nedenler `docs/PROGRESS.md` "Faz 10" bölümünde.

Kaynaklar: `docs/ROADMAP.md`, `docs/PROGRESS.md`, `docs/OPERATIONS.md`, `/root/.claude/plans/faz10-kalanlar.md`.

## 5. Faz 12/13 (COD-AB) ile gelen kararlar
- **BE resmî bölünme (karar):** BeSt Address (CC BY 4.0, 312 MB/yenileme) + Flaman VRBG WFS ile belediyeler ve Flaman düzeyleri alınabilir ama il/bölge hiyerarşisi için NIS-önek eşleme tablosu gerekir (elle liste = otomasyon kuralına aykırı) ve Wikidata katmanı zaten aynı hiyerarşiyi veriyor. İsterseniz yalnızca belediye düzeyini resmî kaynaktan ekleyip hiyerarşiyi Wikidata'dan alırız; söylemezseniz BE Wikidata'da kalır.
- **Üst veri sahibi lisansları (44 ülke ⚪/🔴):** konteynerden okunamadı (Cloudflare, TLS, proxy) veya yalnızca «tüm hakları saklıdır» var. Tarayıcıdan okuyabileceğiniz ülkelerin (ID, PH, TH, KE, ET, GH, CR, DO, AF, LA, MN, MV, RO, HT, PE, BO, EC …) kurum telif/kullanım sayfalarını bana iletirseniz (veya erişimi olan bir ortamda `npm run cod:evidence`) kanıt kaydını tamamlayıp ülkeleri geri alırım. Yazılı izin istemeyeceğiniz kararı geçerli.
- **BR (IBGE) lisansı:** `docs/licenses/nat-br.md` açık; IBGE kendi lisansı okunursa BR COD-AB'den (veya doğrudan IBGE'den) eklenir. Şu an dışarıda.
- **Anlaşmazlık bölgesi politikası (PS, UA, GE, MA…):** karar verilene kadar PS/UA/GE ack'lenmedi.
- **OCHA'nın istediği atıf cümlesi:** HDX'te açık bir "cite as" metni okunamadı; kullandığımız atıf CC BY 3.0 IGO'nun asgari gereklerine göredir (avukat maddesi).
- **Ack kararlarının gözden geçirilmesi:** ack = üst kaynak metninin resmî bir ulusal kurum olduğunu söylemesi; tek tek ulusal kurum lisansları okunmadı. İsterseniz belirli bir ülkeyi geri almak için `cod_review.status`'u `pending` yapmak yeterli (ülke ilk `refresh`'te kaldırılır).
