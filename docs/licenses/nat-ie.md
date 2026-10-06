# Lisans dossier'i: nat-ie

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-06 (ajan okuması + bağımsız ikinci geçiş: ArcGIS öğe açıklaması ve katman yeniden çekildi)
- **Yayıncı / veri seti:** Tailte Éireann (Ordnance Survey Ireland) — «National Statutory Boundaries – Local Authorities Ungeneralised – 2026» (ArcGIS FeatureServer, `services-eu1.arcgis.com/FH5XCsx8rYXqnjF5/…`), vintage'a göre yeni servis; güncel olan hub arama API'sinden (`data-osi.opendata.arcgis.com/api/search/v1/…`) başlığındaki yıla göre seçilir.
- **Kullandığımız alanlar:** `BDY_ID`, `BDY_TYPE_VALUE`, `ENG_NAME_VALUE`, `GLE_NAME_VALUE` (geometri alınmaz; `returnDistinctValues=true` ile 31 birim).

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL |
|---|---|---|---|---|
| 1 | Lisans | CC BY 4.0 | Öğe açıklaması: "Tailte Éireann content published as open data is licenced under a Creative Commons Attribution 4.0 International (CC BY 4.0) licence, details found at the above link." ; `accessInformation`: "© Tailte Éireann" | https://www.arcgis.com/sharing/rest/content/items/74b839e09e1c48f2b2fe4efccb52a73d?f=json |
| 2–5 | Ticari kullanım, yeniden dağıtım, türev/API satışı, alt-lisans | evet (CC BY 4.0 genel koşulları) | (aynı) | https://creativecommons.org/licenses/by/4.0/ |
| 6 | Atıf | "Contains data © Tailte Éireann, licensed under CC BY 4.0" | — | — |
| 7–8 | Share-alike / non-commercial | yok | — | — |
| 9 | Üçüncü taraf | OKUNAMADI | — | — |
| 11 | ToS / indirme | herkese açık REST servisi, anahtar yok; hız limiti OKUNAMADI | — | — |
| 12–16 | Veritabanı hakkı, kişisel veri (yok), garanti, şart değişikliği, ihracat | OKUNAMADI / uygulanmaz | — | — |

**Resmî sayı kanıtı:** öğe açıklaması: "The country is currently divided into 31 local authorities." (31 ayrı `BDY_ID`; 26 county council + 3 city council ... katman 28 County Council + 3 City Council sayıyor). Kodlar resmî `BDY_ID` (örn. 55001 Donegal).
**Güncellik:** LA/ED öğeleri 2026-04-01'de düzenlenmiş; hub 2019, 2024, 2026 vintage'larını listeler. **Sınırlar:** seçim bölgeleri (ED, ~3.4 bin; CSO 2022 kodlarıyla veya OSi `BDY_ID`yle) bu sürümde yüklenmedi; adlar büyük harf (`DONEGAL COUNTY COUNCIL`); lisans izleme 2026 öğesine bakar (yeni vintage'da eski öğe izlenmeye devam eder).

## Karar
**🟢** (CC BY 4.0, atıfla). Açık: ED düzeyi eklenmedi; CC BY 4.0 yasal metni bu oturumda yeniden çekilmedi (başka dossier'lerde okundu).
