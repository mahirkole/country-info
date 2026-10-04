# Yazılı teyit istenecek yayıncılar (OUTREACH)

Hukuki görüş değildir; bu liste, okunan metinde boşluk kalan veya izin şartı bulunan kaynaklar için yayıncıya yazılacak soruları toplar. Yanıtlar `docs/licenses/<id>.md`'ye işlenir; yanıt gelene kadar kaynağın kararı değişmez.

| Öncelik | Kaynak | Kime | Sorulacak (kısa) | Durum |
|---|---|---|---|---|
| 1 | gisco-lau (🔴) | Eurostat GISCO (ESTAT-GISCO@ec.europa.eu), EuroGeographics | LAU öznitelik CSV'si (kod, ad, nüfus, alan; geometrisiz) ticari API/dosya satışı için izinli mi? "Specific download rules"ın tam metni nedir? EuroBoundaryMap kökenli öznitelikler "communes" ticari yasağına tabi mi? Nüfus rakamları için ulusal kaynak şartı var mı? | Gönderilmedi |
| 1 | gisco-nuts (🟡) | Eurostat GISCO | NUTS öznitelik CSV'sinin Eurostat genel yeniden kullanım politikası (CC BY 4.0, Karar 2011/833/AB) kapsamında ticari satışa uygun olduğunu yazılı teyit eder misiniz? | Gönderilmedi |
| 1 | un-m49 (🔴) | UN Statistics Division / UN Publications (permissions) | M49 ülke/bölge kodları ve hiyerarşisini ticari bir veri servisinde yeniden dağıtmak için yazılı izin | Gönderilmedi |
| 2 | geonames (🟡) | GeoNames (marc@geonames.org) | cities15000/admin1/admin2/countryInfo içeriği için üst kaynak lisanslarının ticari türev veritabanı/API satışına engel olup olmadığı; CC BY sürümü | Gönderilmedi |
| 2 | iana-tld (🟡) | IANA (iana@iana.org) | TLD listesi ve Root Zone DB için yeniden dağıtım/ticari kullanım koşulu | Gönderilmedi |
| 2 | nat-us (🟡) | Census Bureau Geography Division | ANSI/FIPS kod dosyaları için ticari kullanım/yeniden dağıtım teyidi | Gönderilmedi |
| 2 | nat-fr (🟡) | INSEE / DINUM (geo.api.gouv.fr) | COG ad/kod/nüfus alanları Licence Ouverte 2.0 kapsamında mı; API'nin OSM kökenli alanları var mı | Gönderilmedi |
| 2 | nat-nl, nat-no (🟡) | CBS, Kartverket/Geonorge | Tablo/veri seti düzeyinde lisans (CC BY 4.0 / NLOD) teyidi | Gönderilmedi |
| 3 | nat-ch (🔴/⚪) | BFS (raumnomenklaturen@bfs.admin.ch) | Amtliches Gemeindeverzeichnis hangi opendata.swiss şartıyla (OPEN/BY/ASK) yayımlanıyor | Gönderilmedi |
| 3 | TÜİK, NVİ, PTT | Kurum iletişim kanalları (Türkiye) | Kullanım koşulları, toplu erişim, ticari yeniden dağıtım | Kullanıcı eylemi gerekir |

| 1 | **nat-tr (🔴)** | TÜİK (Bilgi Edinme / veri talebi), NVİ (Adres Kayıt), data.gov.tr / CBDDO | TÜİK Yasal Uyarı "kaynak gösterilerek izin gerekmeden yeniden kullanım" diyor ama telif TÜİK'te: İBBS ve il/ilçe kodlarının ticari API/dosya satışı için yazılı izin; NVİ UAVT/MAKS toplu erişimi ve ticari yeniden dağıtım; PTT posta kodları | **Kullanıcı eylemi gerekir** (Türkiye) |
| 2 | nat-in (🔴) | LGD / MoPR, Census of India | LGD verisinin GODL-India kapsamında ticari yeniden kullanımı | Gönderilmedi |
| 2 | nat-kr (🟡/🔴) | MOIS / KOSTAT (data.go.kr) | 행정동 verisinin KOGL türü; 법정동 KOGL-3 için türev izni | Gönderilmedi |
| 3 | nat-br (⚪) | IBGE | Kullanım şartları (403 nedeniyle okunamadı) | Gönderilmedi |
| 3 | nat-be (⚪) | Statbel | Open data şartları (CAPTCHA nedeniyle okunamadı) — insan okuması da yeterli | Gönderilmedi |

Not: ajanların diğer dalga dossier'leri (SE, GB, AU, DE, ES, AT, BE, FI, DK, PL, IE, PT, CZ, CA, JP, CH, KR, BR, IN, TR) geldikçe bu listeye eklenir.
