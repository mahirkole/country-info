> **Ajan araştırması, 2026-10-04.** Bağımsız ikinci geçiş: 9 URL yeniden çekildi; özgün dildeki alıntı parçalarından 6 tanesi kaynakta bulundu, 1 tanesi bulunamadı (bulunamayanlar çoğunlukla ajanın kendi Türkçe notları/biçim farkları). Statbel metni okunamadı (CAPTCHA) — insan okuması gerekir

# Lisans dossier'i: nat-be

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-04
- **Yayıncı / veri seti:** Statbel (Statistics Belgium, FOD Economie) — "REFNIS code / NIS-code" (bölge, il, idari arrondissement, belediye; 5 hane). Veri seti sayfası (AB portalındaki kayda göre): https://statbel.fgov.be/en/open-data/code-refnis-0
- **Kullandığımız alanlar / dosyalar:** NIS/REFNIS kodları + adlar + hiyerarşi (TU_COM_REFNIS xlsx/zip). Geometri alınmaz.
- **ÖNEMLİ:** statbel.fgov.be ve data.gov.be'ye her istek (HTTP 200 ama) bot-doğrulama (CAPTCHA/JS challenge) sayfası döndürdü: "Please enable JavaScript to view the page content. ... This question is for testing whether you are a human visitor and to prevent automated spam submission." Bu doğrulama aşılmaya ÇALIŞILMADI. Yayıncının kendi lisans metni bu yüzden **okunamadı**. Tek ikincil kanıt AB veri portalı (data.europa.eu) üzerindeki, data.gov.be'den toplanan **meta veri kaydıdır**; yayıncı sayfası değildir.

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL | Sayfa sha256 |
|---|---|---|---|---|---|
| 1 | Lisans adı/sürümü ve lisans metni URL'si | OKUNAMADI (birincil). İKİNCİL (yalnızca meta veri): AB portalı kaydında dağıtımlar için "CC_BY_4_0" yazıyor. | Kayıttaki alan: `"license": {"id": "CC_BY_4_0", "label": "Creative Commons Attribution 4.0 International", "resource": "http://spdx.org/licenses/CC-BY-4.0"}` (TU_COM_REFNIS-20250101.zip ve .xlsx dağıtımları). Birincil sayfa: CAPTCHA. | İkincil: https://data.europa.eu/api/hub/search/search?q=refnis%20statbel&limit=10&filter=dataset (kayıt id `nodeid5752`) ; Denenen birincil: https://statbel.fgov.be/en/about-statbel/open-data | İkincil: 5d7f2dd4e5b2c8efd4fb13bc12e621cf92183a43957a2f8f242a6a163f49e16f ; Birincil (CAPTCHA sayfası): 266f742b2957367e773f7f29697dbec3ddacfe590fc8839a7945f4d30f071643 |
| 2 | Ticari kullanım | OKUNAMADI (Statbel metni). CC BY 4.0 doğruysa serbest (CC deed: "for any purpose, even commercially") ama Statbel'in kendi şartları okunmadı. | CC deed: "Share — copy and redistribute the material in any medium or format for any purpose, even commercially." | https://creativecommons.org/licenses/by/4.0/ | 8dda1ccec4be91fc80821d4e4fd5c568072b9a3a74b2fdc07c249a27e920ef01 |
| 3 | Ham veriyi yeniden dağıtma | OKUNAMADI | — Denenen: statbel.fgov.be/en/about-statbel/open-data, /en/disclaimer, /en/about-statbel/legal-notice, /nl/about-statbel/open-data, /en/open-data/refnis-codes, data.gov.be/en, data.gov.be/en/datasets/..., data.gov.be CKAN API, robots.txt: hepsi CAPTCHA | — | be1 266f742b2957367e773f7f29697dbec3ddacfe590fc8839a7945f4d30f071643 ; be2 00254e03a8c7263255c52a05a348513e75829a9a055bf82e9ee4974f11162325 ; be6 60d98e1d8f688dcf9bbeac4afcdf46d6c2bafb411e044e1086059adc4e1634ee ; be7 2ba290b296c2579be71236f82d9acd5cd773d92743ab23c68dae8d50084cf825 ; be8 4e643abebf6244317e52bed44413f5f2b637fbf0ec47d5e1eb10a6e011f5f9c4 (hepsi aynı CAPTCHA gövdesi) |
| 4 | Türetilmiş veritabanı / API satışı | OKUNAMADI | — | — | — |
| 5 | Alt-lisans / müşteri yeniden dağıtabilir mi | OKUNAMADI | — | — | — |
| 6 | Atıf metni ve biçimi | OKUNAMADI | — | — | — |
| 7 | Share-alike / viral | OKUNAMADI | — | — | — |
| 8 | Non-commercial / izin (ASK) şartı | OKUNAMADI | — | — | — |
| 9 | Üçüncü taraf IP istisnaları | OKUNAMADI | — | — | — |
| 10 | Marka/logo, onay izlenimi yasağı | OKUNAMADI | — | — | — |
| 11 | ToS: otomatik indirme / hız limiti / kimlik doğrulama | OKUNAMADI. Gözlem: statbel.fgov.be otomatik istemcilere insan-doğrulama (CAPTCHA) uyguluyor; dolayısıyla otomatik indirme dosya URL'sinde de (TU_COM_REFNIS xlsx) CAPTCHA döndü. Bu bir teknik/ToS riskidir. | `Please enable JavaScript to view the page content. Your support ID is: ... This question is for testing whether you are a human visitor and to prevent automated spam submission.` | https://statbel.fgov.be/sites/default/files/files/opendata/REFNIS_CODES/TF_REFNIS_CODES.xlsx (tahmin edilen URL; CAPTCHA döndü) | 2ba290b296c2579be71236f82d9acd5cd773d92743ab23c68dae8d50084cf825 |
| 12 | Veritabanı hakkı / ülke özgü kısıt | OKUNAMADI (Statbel). CC BY 4.0 madde 4 veritabanı haklarını kapsar (yalnızca lisans doğruysa). | CC: "Section 2(a)(1) grants You the right to extract, reuse, reproduce, and Share all or a substantial portion of the contents of the database" | https://creativecommons.org/licenses/by/4.0/legalcode.en | 58230517b7895aa219ff46a6ed63e67057a1582fb9ea054b16728a8c13525650 |
| 13 | Kişisel veri | Belediye/il/bölge kod listesinde kişisel veri beklenmez, ancak OKUNAMADI (veri dosyası indirilemedi). | — | — | — |
| 14 | Garanti reddi / sorumluluk | OKUNAMADI (Statbel) | — | — | — |
| 15 | Şart değişikliği hakkı / sürüm | OKUNAMADI | — | — | — |
| 16 | Yaptırım/ihracat kısıtı | OKUNAMADI | — | — | — |

## Güncelleme (refresh) bilgisi
- **Yayın sıklığı** (kaynağın kendi beyanı): OKUNAMADI (Statbel sayfası). İkincil (AB kaydı, yayıncı beyanı değil): dağıtım dosya adı `TU_COM_REFNIS-20250101` (1 Ocak 2025 durumu); kayıt `temporal` 2025-01-01..2025-12-31; AB kaydı modified 2026-10-03. **Sürüm/vintage adlandırması:** dosya adında YYYYMMDD durum tarihi. **Değişim bildirimi:** OKUNAMADI. **Kararlı URL mi:** AB kaydındaki indirme URL'leri `https://statbel.fgov.be/sites/default/files/files/opendata/REFNIS%20code/TU_COM_REFNIS-20250101.zip` ve `.xlsx` (AB kaydından; doğrudan indirme CAPTCHA'ya takılabilir, denenmedi). Landing: https://statbel.fgov.be/en/open-data/code-refnis-0.
- **Teknik not:** AB kaydı açıklaması: "NSI-code of regions, provinces, administrative districts and municipalities (5 digits)". Format zip/xlsx. Satır sayısı/kodlama: OKUNAMADI (dosya indirilemedi). Yayıncı: "North Gate II & III - INS (STATBEL - Statistics Belgium)", iletişim statbel@economie.fgov.be.

## Karar
- **⚪ okunamadı** — gerekçe: Statbel sitesi ve data.gov.be otomatik istemcilere CAPTCHA döndürdü; yayıncının lisans/ToS metni okunamadı. Yalnızca ikincil AB meta verisi CC BY 4.0 diyor; bu "birincil kanıt" sayılmaz. Bu bulgu "CC BY 4.0" varsayımını destekler ama doğrulamaz.
- Açık sorular / yayıncıya yazılacak teyit: statbel@economie.fgov.be adresine: (1) REFNIS/NIS kod listesinin lisansı (CC BY 4.0?) ve ticari dağıtım/türev veritabanı satışına izin, (2) otomatik indirme için CAPTCHA'sız kararlı URL/API var mı. İnsan tarayıcıyla manuel okuma (ikinci kişi) gerekli: https://statbel.fgov.be/en/about-statbel/open-data ve /en/disclaimer.
- Okuyan: Claude (alt-ajan, curl + python) Bağımsız ikinci geçiş yapıldı mı: hayır (2026-10-04)
