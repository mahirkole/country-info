# Lisans dossier'i: nat-cy

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-06 (ajan okuması + bağımsız ikinci geçiş: lisans cümlesi ve ArcGIS katmanları yeniden çekildi)
- **Yayıncı / veri seti:** Τμήμα Κτηματολογίου και Χωρομετρίας (Kıbrıs Arazi ve Haritalama Dairesi, DLS) — «Διοικητικά Όρια Δήμων και Κοινοτήτων – Διοικητικός Χάρτης», `https://www.data.gov.cy/el/dataset/dioikitika-oria-dimon-kai-koinotiton-dioikitikos-hartis`; veri: ArcGIS REST `eservices.dls.moi.gov.cy/arcgis/rest/services/National/AdminBoundaries_Indexes_GR/MapServer` katman 10 (6 επαρχία) ve 11 (613 δήμος/κοινότητα alanı), `returnGeometry=false`.
- **Kullandığımız alanlar:** `DIST_CODE`, `DIST_NM_G`, `VIL_CODE`, `VIL_NM_G` (geometri alınmaz). Kişisel veri yok.

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL |
|---|---|---|---|---|
| 1 | Lisans | CC BY 4.0 | veri seti sayfası: "Άδεια Χρήσης Creative Commons Attribution 4.0 International (CC BY 4.0)" | https://www.data.gov.cy/el/dataset/dioikitika-oria-dimon-kai-koinotiton-dioikitikos-hartis |
| 2–5 | Ticari kullanım, yeniden dağıtım, türev/API satışı, alt-lisans | evet (CC BY 4.0 genel koşulları) | (aynı) | (aynı) |
| 6 | Atıf | "Source: Department of Lands and Surveys, Republic of Cyprus (data.gov.cy), CC BY 4.0" (yayıncı: Τμήμα Κτηματολογίου και Χωρομετρίας) | — | — |
| 7–8 | Share-alike / non-commercial | yok | — | — |
| 9 | Üçüncü taraf | OKUNAMADI | — | — |
| 11 | ToS / indirme | herkese açık REST servisi, anahtar yok; hız limiti OKUNAMADI | — | — |
| 12–16 | Veritabanı hakkı, kişisel veri (yok), garanti, şart değişikliği, ihracat | OKUNAMADI / uygulanmaz | — | — |

**Güncellik:** sayfa "Modified 29/08/2024", "Release Date 18/12/2017", "Frequency Ακανόνιστα" (düzensiz); servis canlı. **Sayı:** 6 επαρχία, 613 alan (612 ayrı ad: «Αγία Βαρβάρα» iki ilçede); resmî sayı beyanı bulunamadı (adaptör 600–625 bandı). **Sınırlar:** katman belediye/kasaba ayrımı vermez (tür `municipality`, `type_local` "δήμος/κοινότητα"); adlar Yunanca büyük harf; Kıbrıs Cumhuriyeti'nin idari birimleri olarak Girne (2) ve Gazimağusa (3) ilçeleri de dahildir (ihtilaflı bölge politikası: `docs/KULLANICI-BEKLENTILERI.md` madde 15).

## Karar
**🟢** (CC BY 4.0, atıfla). Açık: resmî sayı ve belediye/kasaba ayrımı yok; güncelleme düzensiz; yayıncı sayfası dışında lisans metni okunmadı (CC BY 4.0 standart metni başka dossier'lerde okundu).
