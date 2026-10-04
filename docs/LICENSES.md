# Kaynak lisansları ve satış değerlendirmesi

> Bu belge hukuki görüş değildir. Aşağıdaki "okundu" ifadeleri 2026-10-04'te ilgili sayfaların metninin okunduğu anlamına gelir; ticari lansmandan önce bir avukatla teyit edin.

## Kaynak bazında

| Kaynak | Ne alıyoruz | Ne okundu | Ticari satış? | Yükümlülük |
|---|---|---|---|---|
| **GeoNames** (`geonames`) | ülke nitelikleri, admin1/admin2 | geonames.org/export: "cc-by licence… commercial usage is allowed 'as is'" | **Evet** | Bağlantılı atıf (GeoNames'e kredi). Veri "olduğu gibi", doğruluk garantisi yok. Sürüm (3.0/4.0) sayfada belirtilmemiş → dump README'sinden teyit edin. |
| **Eurostat GISCO – NUTS, LAU** (`gisco-nuts`, `gisco-lau`) | yalnızca **öznitelik CSV'leri** (kod, ad, nüfus, alan); **geometri/sınır almıyoruz** | Eurostat telif sayfası: "reuse… for commercial or non-commercial purposes is authorised provided the source is acknowledged… no special procedure or written licence"; NUTS/LAU sayfalarında ek ticari kısıt bulunmadı | **Evet (okunan metne göre)** | Kaynak gösterimi: "Source: Eurostat / GISCO …". Eurostat "başka kaynaklara ait veri" için istisna koyar; LAU nüfus/alan değerleri ulusal istatistik kurumlarından derleniyor olabilir → teyit edin. |
| GISCO **"administrative units"** (communes, countries, postal codes) | **Kullanmıyoruz** | Sayfada "the data will not be used for commercial purposes"; ticari kullanım için EuroGeographics lisansı | **Hayır** | Bu veri setlerini eklemeyin. Sınır/geometri (NUTS dahil) eklenecekse © EuroGeographics koşulları yeniden okunmalı. |
| **U.S. Census Bureau** (`nat-us`) | state/county ANSI-FIPS kodları | open-data politika sayfası okundu; açık "public domain" ifadesi bulunamadı | **Evet** (ABD federal eseri, 17 U.S.C. § 105) | Atıf önerilir. `licenseStatus: partial`. |
| **INSEE COG / geo.api.gouv.fr** (`nat-fr`) | bölge, département, komün adları/kodları/nüfus | api.gouv.fr sayfası: "Toutes les données… sous licences Open Data"; INSEE lisans metni bulunamadı | **Büyük olasılıkla evet (Licence Ouverte)**, metin teyit edilmeli | Atıf. API OpenStreetMap ortaklığı da listeliyor; **geometri/OSM verisi alınmıyor**. `licenseStatus: partial`. |
| **ISTAT (İtalya)** (`nat-it`) | bölge, UTS/province, comune adları ve kodları, NUTS kodları | ISTAT Note legali okundu: "Salvo diversa indicazione, tutti i contenuti… licenza Creative Commons – Attribuzione – versione 4.0" | **Evet** | Atıf ("Fonte: Istat"). `licenseStatus: read`. |
| **CBS (Hollanda)** (`nat-nl`) | landsdeel, provincie, gemeente | CBS telif sayfası okundu: web sitesi içeriği CC BY 4.0, CBS kaynak gösterilmeli; OData tablosuna ayrı lisans metni bulunamadı | **Büyük olasılıkla evet** | Atıf ("Bron: CBS"). `partial`. |
| **Kartverket/Geonorge (Norveç)** (`nat-no`) | fylke, kommune | Geonorge katalog kaydı: "Åpne data", "No conditions apply to access and use"; lisans bağlantısı kayıtta yok | **Büyük olasılıkla evet** | Atıf önerilir. `partial`. Geometri saklanmıyor. |
| **BFS (İsviçre)** | Gemeindeverzeichnis | opendata.swiss 4 kullanım şartı okundu (Open / BY / ASK / BY ASK); BFS paketinde hangisi olduğu okunamadı | **Bilinmiyor → alınmıyor** | Ticari kullanım için izin gerekebilir ("ASK"). |
| **Tatil verileri** (`official-holidays`) | tarih ve adlar; her kayıtta resmi atıf | AT: RIS, ES: BOE, IT: Normattiva, DE: gesetze-im-internet metinleri okundu | Büyük olasılıkla evet (olgusal veri); **mevzuat metnini kopyalamıyoruz, yalnızca atıf veriyoruz** | Her kayıtta `source.citation/url`. Resmi metinlerin yeniden kullanım şartı ülkeden ülkeye değişir → ülke eklerken kontrol edin. |
| **Nager.Date** | **Hiçbir veri almıyoruz**; yalnızca `check:holidays` ile karşılaştırma | – | – | Veri kaynağı yapılırsa MIT lisansı ve gönüllü bakım riski yeniden değerlendirilmeli. |
| TÜİK, NVİ, PTT, data.gov.tr, Resmî Gazete, Diyanet, mevzuat.gov.tr | Henüz veri yok | Erişilemedi / lisans okunamadı | **Bilinmiyor** | **Doğrulanmadan veri alınmaz.** PTT posta kodlarını kopyalamayın. |
| **OpenStreetMap** (planlı) | – | – | ODbL: satış serbest ama türetilmiş veritabanı için share-alike | Eklenmeden önce hukuki değerlendirme. |

## Toplayıp satmak sorun olur mu? (kısa cevap)
- **Şu anki içerik için, okunan metinlere göre ticari satış engeli görmedim**, şartıyla: (1) atıfları gösterin, (2) "olduğu gibi" sunun, (3) yukarıdaki "teyit edin" maddelerini kapatın.
- **Gerçek riskler lisanstan çok başka yerde:**
  1. **Doğruluk sorumluluğu:** tatil/idari veri hatası müşteriye maliyet yaratabilir. Sözleşmede sorumluluk sınırı ve "doğrulanmış/doğrulanmamış" ayrımı (`verification`) şart. `unverified` kayıtları "resmi doğrulanmış" diye satmayın.
  2. **Yeni kaynak eklerken** lisans değişir: özellikle PTT/NVİ/TÜİK, OSM (ODbL), GISCO "administrative units" (ticari yasak) ve ticari adres veri setleri.
  3. **Veri tabanı hakkı (AB):** kaynak veritabanlarının sui generis hakkı olabilir; bunu lisanslar genelde yeniden kullanıma izin vererek aşar, ama kaynak lisansı izin vermiyorsa sorun olur.
  4. **Kişisel veri:** sokak/bina düzeyi adres verisi KVKK/GDPR kapsamına girebilir (şu an dahil değil).

## Uygulanan teknik önlemler
- `sources` tablosu: `license` ve `attribution` alanları; her `entity` bir `source_id` taşır.
- `GET /v1/sources`: kaynak, lisans ve gösterilecek atıf metni.
- Dışa aktarımda `ATTRIBUTION.md` (her snapshot ve `latest/`).
- Lisansı belirsiz veya ticari kısıtlı kaynak eklenmez; `docs/sources/*.md` erişim/okuma durumunu tutar.
