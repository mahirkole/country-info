> **Ajan araştırması, 2026-10-04.** Bağımsız ikinci geçiş: 16 URL yeniden çekildi; özgün dildeki alıntı parçalarından 13 tanesi kaynakta bulundu, 7 tanesi bulunamadı. 9 URL çekilemedi

# Lisans dossier'i: nat-in

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-04
- **Yayıncı / veri seti:** Local Government Directory (LGD), Ministry of Panchayati Raj (NIC tarafından barındırılıyor) — eyalet, ilçe (district), alt ilçe (sub-district), köy, PRI/kentsel/geleneksel yerel yönetim kodları. Census of India kod dizini (ORGI) ve GODL/NDSAP metni OKUNAMADI (aşağıya bakın).
- **Kullandığımız alanlar / dosyalar:** (planlanan) LGD "Download Directory" ile State/District/Sub-district (ve gerekirse Village) kod+ad listeleri. Geometri ve kişisel veri yok. Hiçbir dosya indirilmedi.

Kısaltmalar ve sha256 (ham gövde):
- LGD = https://lgdirectory.gov.in/ — `8c8ef6477f78ad70b428c212be9126f74a9ce0c97f7852d8fbb1cc091bc63333`
- CR = https://lgdirectory.gov.in/copyRightPolicy.do — `8894bd71ef3f29443560a36d9a11b738ff40d1286aa59d948ca4aef221520232`
- TC = https://lgdirectory.gov.in/termsconditions.do — `993971a8f8cdcb2020a71b848e06843c53673d83f0bfd18a30df9dafce1edf65`
- PP = https://lgdirectory.gov.in/privacyPolicy.do — `679c24972d0c53822718c7f8ec0c69feb3ad0ee60ed68e61081aebb8a3a8a7d0`
- DL = https://lgdirectory.gov.in/downloadDirectory.do — `b1586ee123671b860e15a58b53c130ec9bcee34462219d995a09c17d4cbbc853`

Erişim denemeleri (2 kez): 
- https://data.gov.in/sites/default/files/Gazette_Notification_OGDL.pdf, https://data.gov.in/government-open-data-license-india, https://data.gov.in/, https://data.gov.in/Godl: OKUNAMADI, bağlantı sıfırlandı (curl 35). https://www.data.gov.in/... (aynı yollar): HTTP 503 "An error occurred while processing your request" (Akamai referansı). Dolayısıyla **GODL-India ve NDSAP metinleri okunamadı**.
- https://censusindia.gov.in/ ve /nada/index.php/catalog, https://www.censusindia.gov.in/: curl (60) "SSL certificate problem: unable to get local issuer certificate" (TLS doğrulaması kapatılmadı): OKUNAMADI. https://egazette.gov.in/: aynı TLS hatası. https://dst.gov.in/sites/default/files/NDSAP.pdf: 404. https://ogpl.gov.in/ ve https://opengovdata.gov.in/: proxy 502.
- LGD sitesi: ana sayfa ve altı sayfa HTTP 200 okundu.

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL | Sayfa sha256 |
|---|---|---|---|---|---|
| 1 | Lisans adı/sürümü ve lisans metni URL'si | Adlandırılmış lisans YOK. LGD yalnızca kendi "Copyright Policy" metnini yayımlıyor; GODL-India'ya atıf bulunamadı (LGD ana sayfa, CR, TC, PP, DL sayfalarında "GODL", "OGDL", "NDSAP", "licence" aramaları sonuçsuz). | "Material featured on this site may be reproduced free of charge in any format or media without requiring specific permission." | CR | 8894bd71…520232 |
| 2 | Ticari kullanım serbest mi? | OKUNAMADI: metin "ticari" kelimesini içermiyor; yalnızca "ücretsiz çoğaltma" diyor | (aynı cümle) | CR | 8894bd71…520232 |
| 3 | Ham veriyi yeniden dağıtma (dump satışı) | şartlı/belirsiz: "reproduced … in any format or media" (satış anılmıyor); doğruluk ve yanıltıcı olmama şartı | "This is subject to the material being reproduced accurately and not being used in a derogatory manner or in a misleading context." ; "Where the material is being published or issued to others, the source must be prominently acknowledged." | CR | 8894bd71…520232 |
| 4 | Türetilmiş veritabanı / API satışı | OKUNAMADI (türetme/uyarlama hükmü yok; "accurately" şartı değişikliği kısıtlıyor olabilir) | "reproduced accurately" | CR | 8894bd71…520232 |
| 5 | Müşteriye alt-lisans / yeniden dağıtım | "published or issued to others" için kaynak gösterimi şart; alt-lisans hükmü OKUNAMADI | "Where the material is being published or issued to others, the source must be prominently acknowledged." | CR | 8894bd71…520232 |
| 6 | Atıf metni ve biçimi | "source must be prominently acknowledged"; biçim şablonu YOK | (aynı) | CR | 8894bd71…520232 |
| 7 | Share-alike / viral şart | yok (okunan metinde) | — | CR | 8894bd71…520232 |
| 8 | Non-commercial / izin gerektiren (ASK) şart | Belirtilmemiş (izin gerekmiyor deniyor); ticari ifade yok | "without requiring specific permission" | CR | 8894bd71…520232 |
| 9 | Üçüncü taraf IP istisnaları | var | "the permission to reproduce this material doesn't extend to any material on this site, which is explicitly identified as being the copyright of a third party. Authorisation to reproduce such material must be obtained from the copyright holders concerned." | CR | 8894bd71…520232 |
| 10 | Marka/logo, onay izlenimi yasağı | OKUNAMADI (açık hüküm yok; "derogatory/misleading context" yasağı var) | "not being used in a derogatory manner or in a misleading context" | CR | 8894bd71…520232 |
| 11 | ToS: otomatik indirme / hız limiti / kimlik doğrulama | Hüküm OKUNAMADI. İndirme "Download Directory" formu üzerinden (varlık seçimi, "Download Only Modifications" From/To Date); sayfa "/js/captcha.js" yüklüyor (CAPTCHA kullanımı, otomasyon engeli olabilir; form davranışı denenmedi). Resmî API/toplu dosya bağlantısı bulunamadı. | DL: "Download Directory(one entity at a time)" ; "Download All Entities of State" ; "Download Only Modifications" | DL | b1586ee1…bc853 |
| 12 | Veritabanı hakkı / ülke özgü kısıt | OKUNAMADI. TC: Hint hukuku ve mahkemeleri. | "These terms and conditions shall be governed by and constructed in accordance with the Indian Laws. Any dispute arising under the terms and conditions shall be subject to the jurisdiction of the courts of India." | TC | 993971a8…edf65 |
| 13 | Kişisel veri | Kod/ad listeleri; kişisel veri yok (köy/panchayat düzeyi). Gizlilik politikası ziyaretçi verisi içindir (PP içeriği ayrıca ayrıntılı okunmadı). | DL varlık listesi: "All States of India", "All Districts of India", "All Sub-Districts of India", "All Villages of India" | DL | b1586ee1…bc853 |
| 14 | Garanti reddi / sorumluluk | var; ayrıca hukuki amaçla kullanılmamalı | "…the same should not be constructed as a statement of law or used for any legal purposes." ; "Under no circumstances will this Department/Ministry be liable for any expense, loss or damage including, without limitation, indirect or consequential loss or damage" | TC | 993971a8…edf65 |
| 15 | Şart değişikliği hakkı / sürüm | Değişiklik/sürüm hükmü OKUNAMADI | — | TC | 993971a8…edf65 |
| 16 | Yaptırım/ihracat kısıtı | OKUNAMADI | — | TC | 993971a8…edf65 |

GODL (Government Open Data License - India): görevlendirmede istenen kaynak (Gazette_Notification_OGDL.pdf) okunamadığı için GODL'un metni, ticari kullanım ve LGD'nin GODL kapsamında olup olmadığı **doğrulanamadı**. LGD sitesinin kendisinde GODL'a atıf yok. Ayrıca site sahibi bilgisi: "Contents on this website is owned, updated and managed by the Panchayats and State Panchayati Raj Department as a part of e-Panchayat MMP of Ministry of Panchayati Raj." (veri sahibi eyalet departmanları olabilir; TC: "In case of any ambiguity or doubts, users are advised to verify/check with the State Departments").

## Güncelleme (refresh) bilgisi
- **Yayın sıklığı** (kaynağın kendi beyanı): OKUNAMADI (düzenli takvim beyanı yok); "Download Only Modifications" seçeneği tarih aralığı ile değişiklik indirmeyi mümkün kılıyor. **Sürüm/vintage adlandırması:** yok (yerel yönetim kodları sürekli güncellenen canlı dizin; "Local Body ... with versions" ifadesi sayfalarda geçiyor). **Değişim bildirimi:** OKUNAMADI. **Kararlı URL mi:** Hayır: indirme form/oturum tabanlı (.do uçları, OWASP_CSRFTOKEN parametreleri), sabit dosya URL'si bulunamadı.
- **Teknik not:** Biçim PDF/Xls rapor (sayfada "Pdf Report", "Xls Report"; CSV doğrulanmadı). Varlıklar: States, Districts, Sub-districts, Villages, PRI/Urban/Traditional Local Bodies, Wards, Blocks, parlamento/meclis seçim bölgeleri eşlemeleri. Census (ORGI) senkronizasyonu "Uniform Jurisdictional Directory" olarak anılıyor; Census kod dizini ayrıca okunamadı. Kimlik doğrulaması: indirme için CAPTCHA muhtemel (doğrulanmadı).

## Karar
- **🔴 uygun değil veya bilinmiyor** — gerekçe: LGD'nin okunan tek lisans benzeri metni, materyalin izin gerekmeden ve ücretsiz çoğaltılabileceğini söylüyor, ancak ticari kullanım, satış, türetilmiş veri tabanı ve alt-lisans hakkında hiçbir şey söylemiyor; GODL-India metni ve LGD'nin ona tabi olduğu doğrulanamadı; indirme formu CAPTCHA'lı görünüyor ve sabit toplu URL yok.
- Açık sorular / yayıncıya yazılacak teyit: (1) LGD verisi GODL-India altında mı (data.gov.in'deki LGD veri seti sayfasındaki "License" alanı başka ağdan okunmalı). (2) GODL metni (data.gov.in Gazette_Notification_OGDL.pdf) başka ağdan okunup ticari kullanım/atıf cümleleri kayda alınmalı. (3) LGD ekibine (Ministry of Panchayati Raj) toplu indirme/otomasyon izni ve ticari yeniden dağıtım teyidi. (4) Census of India kod dizini (censusindia.gov.in TLS hatası) okunmadı.
- Okuyan: Claude (otomatik araştırma) Bağımsız ikinci geçiş yapıldı mı: hayır (2026-10-04)
