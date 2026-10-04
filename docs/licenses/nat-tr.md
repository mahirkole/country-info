> **Ajan araştırması, 2026-10-04.** Bağımsız ikinci geçiş: 22 URL yeniden çekildi; özgün dildeki alıntı parçalarından 10 tanesi kaynakta bulundu, 4 tanesi bulunamadı. 12 URL çekilemedi; yalnızca TÜİK Yasal Uyarı sayfası okunabildi

# Lisans dossier'i: nat-tr

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-04
- **Yayıncı / veri seti:** TÜİK (İstatistiki Bölge Birimleri Sınıflaması İBBS, il/ilçe kodları) — **yalnızca kurumun genel "Yasal Uyarı" sayfası okunabildi; İBBS/UAVT veri setine özgü koşul sayfası bulunamadı/okunamadı**. NVİ Adres Kayıt (UAVT), data.gov.tr, PTT posta kodu: OKUNAMADI.
- **Kullandığımız alanlar / dosyalar:** (planlanan) il/ilçe/mahalle kodları ve adları, İBBS düzeyleri; geometri ve kişisel veri alınmayacak. Henüz hiçbir veri dosyası indirilmedi.

Kısaltmalar ve sha256 (ham gövde):
- YU = https://www.tuik.gov.tr/Kurumsal/Yasal_Uyari — `5a3b3c86955b75fd54bcf1c5d1866e80bd11d69fa85c9c6e22cd72481303bbd3`
- UCRET = https://www.tuik.gov.tr/Kurumsal/Veri_Bilgilerin_Ucretlendirilmesi — `8eee1adab8d9c128966e14aebb8a73f25dca6c179b09557f9e8600f1d36c37da`
- TUIK = https://www.tuik.gov.tr/ (ana sayfa) — `c06678cc38e66c3246435b5e1df3bf6eac6c15fefea0f0cd3baadd6ceef4661f`
- SINIF = https://siniflama.tuik.gov.tr/ (Sınıflama Sunucusu) — `2fda86097ec961d84e31ec692fd948d96533af2e74ac5988933a986f62f78f37`

Erişim denemeleri (her biri en az 2 kez; ham curl, TLS doğrulaması açık):
| Adres | Sonuç |
|---|---|
| https://www.tuik.gov.tr/ ; /Kurumsal/Yasal_Uyari ; /Kurumsal/Veri_Bilgilerin_Ucretlendirilmesi ; /Kurumsal/Mikro_Veri | HTTP 200 (ilk denemede; ana sayfa 2. denemede bağlantı hatası, aralıklı) |
| https://siniflama.tuik.gov.tr/ ; https://nip.tuik.gov.tr/ ; https://cip.tuik.gov.tr/ ; https://veriportali.tuik.gov.tr/ | HTTP 200 (veriportali ve cip: yalnızca "JavaScript gerekli" kabuğu; içerik okunamadı) |
| https://data.tuik.gov.tr/ | OKUNAMADI: 2/2 bağlantı hatası (HTTP 000; veriportali.tuik.gov.tr'ye yönleniyor) |
| https://biruni.tuik.gov.tr/ | OKUNAMADI: 2/2 HTTP 503 |
| https://adres.nvi.gov.tr | OKUNAMADI: 2/2 bağlantı hatası (HTTP 000) |
| https://www.nvi.gov.tr/ (+ /ulusal-adres-veri-tabani, /adres-kayit-sistemi, /gizlilik-politikasi) | HTTP 200 okundu; yalnızca gezinme menüsü ve çerez/gizlilik metni, UAVT veri paylaşım/lisans koşulu YOK. /yasal-uyari ve /kullanim-kosullari: 404 |
| https://data.gov.tr/ ; https://www.data.gov.tr ; https://veri.gov.tr ; https://acikveri.gov.tr | OKUNAMADI: HTTP 000 (2/2) |
| https://www.ptt.gov.tr/ ; https://postakodu.ptt.gov.tr ; https://gonderitakip.ptt.gov.tr | OKUNAMADI: HTTP 000 (2/2) |
| https://cbddo.gov.tr ; https://www.cbddo.gov.tr/ (Türkiye açık veri politikası) | OKUNAMADI: HTTP 000 (2/2) |

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL | Sayfa sha256 |
|---|---|---|---|---|---|
| 1 | Lisans adı/sürümü ve lisans metni URL'si | Standart lisans YOK; yalnızca sitenin genel "Yasal Uyarı" metni. İBBS'ye özgü koşul OKUNAMADI. | "İnternet sitemizden, yayınlarımızdan veya veri tabanlarımızdan elde edilen verilerin, kaynak gösterilmek suretiyle herhangi bir izine gerek duymaksızın yeniden kullanımı mümkündür." | YU | 5a3b3c86…3bbd3 |
| 2 | Ticari kullanım serbest mi? | belirsiz: "yeniden kullanım" serbest denmiş, "ticari" kelimesi geçmiyor | (yukarıdaki cümle) ; ters yönde: "telif hakkı ve diğer her türlü hakkı TÜİK'e aittir." | YU | 5a3b3c86…3bbd3 |
| 3 | Ham veriyi yeniden dağıtma (dump satışı) | OKUNAMADI (açık hüküm yok); metindeki "yeniden kullanım" bunu kapsıyor olabilir ama söylenmiyor | "…kaynak gösterilmek suretiyle herhangi bir izine gerek duymaksızın yeniden kullanımı mümkündür." | YU | 5a3b3c86…3bbd3 |
| 4 | Türetilmiş veritabanı / API satışı | OKUNAMADI (açık hüküm yok) | — | YU | 5a3b3c86…3bbd3 |
| 5 | Müşteriye alt-lisans / müşteri yeniden dağıtabilir mi | OKUNAMADI | — | YU | 5a3b3c86…3bbd3 |
| 6 | Atıf metni ve biçimi | "kaynak gösterilmek suretiyle"; biçim tanımı OKUNAMADI | aynı cümle (satır 2) | YU | 5a3b3c86…3bbd3 |
| 7 | Share-alike / viral şart | hüküm bulunamadı | — | YU | 5a3b3c86…3bbd3 |
| 8 | Non-commercial / izin gerektiren (ASK) şart | Çelişkili: izin gerekmez denirken telif hakkı TÜİK'e ait deniyor. İBBS özelinde OKUNAMADI. Ayrıca bilgi *talebi* (özel veri teslimi) ücretlidir. | "Site içerisindeki bilgilerin bir kısmı doğrudan, bir kısmı da diğer kaynaklardan sağlanarak TÜİK tarafından yayımlanmakta olup, telif hakkı ve diğer her türlü hakkı TÜİK'e aittir." ; UCRET: "Web sitesi ve sosyal medya hesapları üzerinden sunulan bilgiler ücretsizdir." ; "Bilgi taleplerinin manyetik ortamda karşılanması halinde; boyutu 1 MB'ye kadar olan bilginin yurt içi taleplerde 130,00 TL …" | YU ; UCRET | 5a3b3c86…3bbd3 ; 8eee1ada…c37da |
| 9 | Üçüncü taraf IP istisnaları | "bir kısmı da diğer kaynaklardan sağlanarak" yayımlanıyor; hangi kısımlar belirtilmemiş | "Siteden bağlantı yapılarak ulaşılan diğer sitelerdeki bilgiler, ilgili kuruluşlar tarafından yayınlanmakta olup, içeriği ve güncelliği TÜİK'i bağlamamaktadır." | YU | 5a3b3c86…3bbd3 |
| 10 | Marka/logo, onay izlenimi yasağı | OKUNAMADI (Kurumsal Kimlik sayfası okunmadı) | — | — | — |
| 11 | ToS: otomatik indirme / hız limiti / kimlik doğrulama | OKUNAMADI. Not: Sınıflama Sunucusu bir web servisi duyuruyor (tuikws.tuik.gov.tr/ws/TUIKSS?wsdl); koşulları okunmadı. | SINIF sayfasında bağlantı: "https://tuikws.tuik.gov.tr/ws/TUIKSS?wsdl" | SINIF | 2fda8609…f37 |
| 12 | Veritabanı hakkı / ülke özgü kısıt | OKUNAMADI. Sitede yalnız: "Bu site Türkiye Cumhuriyeti Kanunları ile korunmaktadır." (5846 sayılı FSEK ve Türkiye İstatistik Kanunu atıfları okunmadı) | "Bu site Türkiye Cumhuriyeti Kanunları ile korunmaktadır." | YU | 5a3b3c86…3bbd3 |
| 13 | Kişisel veri (adres/bina düzeyi; KVKK) | İBBS/il-ilçe kodlarında yok; UAVT/NVİ adres verisi (bina/kapı) OKUNAMADI ve KVKK açısından ayrıca incelenmeli. NVİ sitesinde yalnız ziyaretçi gizlilik metni okundu. | NVİ: "Web sitemizi ziyaret edenlerin kişisel verilerini 6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca işlemekte ve gizliliğini korumaktayız." (ziyaretçi verisi, UAVT değil) | https://www.nvi.gov.tr/ulusal-adres-veri-tabani | 2a5e6cf0…01601 |
| 14 | Garanti reddi / sorumluluk | var | "…olabilecek hatalardan TÜİK hiçbir taahhüt ve sorumluluk kabul etmez." | YU | 5a3b3c86…3bbd3 |
| 15 | Şart değişikliği hakkı / sürüm | tek taraflı | "TÜİK sitede yer alan bütün bilgileri ve tasarımı önceden bildirimde bulunmaksızın değiştirebilir veya kullanım dışı bırakabilir." | YU | 5a3b3c86…3bbd3 |
| 16 | Yaptırım/ihracat kısıtı | OKUNAMADI | — | — | — |

## Güncelleme (refresh) bilgisi
- **Yayın sıklığı** (kaynağın kendi beyanı): OKUNAMADI (İBBS sayfası okunamadı; "Veri Yayımlama Takvimi" sayfası okunmadı). **Sürüm/vintage adlandırması:** OKUNAMADI. **Değişim bildirimi:** OKUNAMADI. **Kararlı URL mi:** OKUNAMADI.
- **Teknik not:** Sınıflama Sunucusu (siniflama.tuik.gov.tr) JS tabanlı, "Sınıflamalar / Dönüşüm Tabloları" menüleri ve bir SOAP/WSDL uç noktası (https://tuikws.tuik.gov.tr/ws/TUIKSS?wsdl) var; indirme biçimi ve lisansı doğrulanmadı. TÜİK ana sayfası aralıklı olarak bağlantı hatası verdi; veriportali.tuik.gov.tr ve cip.tuik.gov.tr JS gerektiriyor (statik okuma yetersiz).

## Karar
- **🔴 uygun değil veya bilinmiyor** (NVİ/data.gov.tr/PTT/açık veri politikası bileşenleri ⚪ okunamadı) — gerekçe: TÜİK'in tek okunan hükmü "kaynak gösterilerek izin gerekmeden yeniden kullanım mümkündür" diyor ama aynı sayfada telif ve tüm hakların TÜİK'e ait olduğu belirtiliyor; ticari kullanım, dump/API satışı, alt-lisans ve İBBS'ye özgü koşul metni okunamadı. CLAUDE.md kuralı gereği (TÜİK/NVİ/PTT lisansı belirsiz) veri yüklenmemeli.
- Açık sorular / yayıncıya yazılacak teyit: TÜİK Bilgi Dağıtım'a yazılı soru: (a) İBBS ve il/ilçe kod listelerinin ticari yeniden dağıtımı ve API ile satışı serbest mi, (b) hangi atıf biçimi, (c) "Yasal Uyarı"daki "yeniden kullanım" ile "telif hakkı TÜİK'e aittir" ifadesinin ilişkisi. NVİ: UAVT kod listelerinin (il/ilçe/mahalle kodu) kamuya açık, yeniden dağıtılabilir bir yayını var mı. data.gov.tr ve Cumhurbaşkanlığı Dijital Dönüşüm Ofisi açık veri politikası/lisansı bu ağdan okunamadı; başka ağdan tekrar denenmeli.
- Okuyan: Claude (otomatik araştırma) Bağımsız ikinci geçiş yapıldı mı: hayır (2026-10-04)
