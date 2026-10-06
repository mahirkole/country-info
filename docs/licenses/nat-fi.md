# Lisans dossier'i: nat-fi

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-06 (ajan okuması + bağımsız ikinci geçiş: kullanım şartları yeniden çekildi)
- **Yayıncı / veri seti:** Tilastokeskus (Statistics Finland) sınıflama servisi `https://data.stat.fi/api/classifications/v2/classifications` — `kunta_1_<tarih>` (308 belediye) ve `maakunta_1_<tarih>` (19 maakunta); kunta→maakunta eşlemesi `correspondenceTables/kunta_1_…#maakunta_1_…/maps` listesi (veri uç noktası HTTP 500 verdiği için yalnızca ?'siz `/maps` listesi okunur; her URL `<kunta>/<maakunta>` kodunu taşır).
- **Kullandığımız alanlar:** kod, ad (fi, sv). Kişisel veri yok.

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL |
|---|---|---|---|---|
| 1 | Lisans | CC BY 4.0 | "Statistics Finland's open data materials and public content of the web service are covered by the Creative Commons Attribution 4.0 International licence." | https://stat.fi/en/about-us/get-to-know-statistics-finland/legislation/terms-of-use |
| 2–5 | Ticari kullanım, yeniden dağıtım, türev/API satışı, alt-lisans | evet | "You can also combine the data with other data and use the data for commercial purposes as well." ; "you can copy, edit and share these data either in original or edited format." | (aynı) |
| 6 | Atıf | "give at least Statistics Finland as the source ( Source: Statistics Finland )" | (aynı sayfa) | (aynı) |
| 7–8 | Share-alike / non-commercial | yok | — | — |
| 9 | Üçüncü taraf | Lisans "data produced by other organisations published on Statistics Finland's website" kapsamaz; sınıflamalar Tilastokeskus'un kendi üretimidir | sayfada "To what does the licence not apply?" | (aynı) |
| 11 | ToS / indirme | herkese açık API, anahtar yok | — | — |
| 12–16 | Veritabanı hakkı, kişisel veri (yok), garanti, şart değişikliği, ihracat | OKUNAMADI / uygulanmaz | — | — |

**Resmî sayı kanıtı:** "In 2026, the number of municipalities in Finland is 308." (`stat.fi/en/luokitukset/kunta/kunta_1_20260101`). 19 maakunta sayısı için açık cümle bulunamadı (adaptör 15–22 bandı); adaptör sayıları 290–330 / 15–22 ile kapılar.
**Sürüm:** adaptör her çalışmada sınıflama listesinden bugün yürürlükte olan en yeni `kunta_1_YYYYMMDD` / `maakunta_1_YYYYMMDD` sürümünü seçer.
**Teknik not:** MML Kuntajako API anahtar ister (401) → kullanılmadı.

## Karar
**🟢** (CC BY 4.0, atıfla). Açık: 19 maakunta için resmî sayı cümlesi yok; kunta→maakunta eşlemesi için yalnızca `/maps` listesi çalışıyor (servis düzelirse veri uç noktasına geçilebilir).
