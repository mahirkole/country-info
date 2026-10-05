# Lisans dossier'i: iana-tz

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-05
- **Yayıncı / veri seti:** IANA Time Zone Database (tzdb), `https://data.iana.org/time-zones/tzdb/` — `zone.tab` (ülke → saat dilimi kimlikleri), `version`.
- **Kullandığımız alanlar:** ülke kodu, IANA bölge kimliği (ör. `Europe/Istanbul`), tzdb'nin alan açıklaması. Koordinat sütunu saklanmaz. Kişisel veri yok.

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL |
|---|---|---|---|---|
| 1 | Lisans | Kamu malı (public domain) | "Unless specified below, all files in the tz code and data (including this LICENSE file) are in the public domain." ; `zone.tab` başlığı: "This file is in the public domain, so clarified as of 2009-05-17 by Arthur David Olson." | https://data.iana.org/time-zones/tzdb/LICENSE ; https://data.iana.org/time-zones/tzdb/zone.tab |
| 2–5 | Ticari kullanım, yeniden dağıtım, türev/API satışı, alt-lisans | serbest (kamu malı; koşul yok) | (aynı) | (aynı) |
| 6 | Atıf | gerekmez; nazik atıf `sources.attribution`'da: "Time zone data: IANA Time Zone Database (public domain)." | — | — |
| 7–8 | Share-alike / non-commercial | yok | LICENSE metninde yok | — |
| 9 | Üçüncü taraf istisnası | LICENSE: tarihsel olarak `date.c`, `newstrftime.3`, `strftime.c` dosyaları BSD-3 (kod; bizim kullandığımız veri dosyaları değil) | "If the files date.c, newstrftime.3, and strftime.c are present, they contain material derived from BSD and use the BSD 3-clause license." | LICENSE |
| 10 | Marka/onay | `zone.tab`: "It is not intended to take or endorse any position on legal or territorial claims." (veri bir hukuki/toprak iddiası değildir) | `zone.tab` başlığı | zone.tab |
| 11 | ToS / otomatik indirme | statik dosya, kimlik doğrulama yok; hız limiti OKUNAMADI | — | — |
| 12–13, 15–16 | Veritabanı hakkı, kişisel veri, şart değişikliği, ihracat | OKUNAMADI / uygulanmaz (kişisel veri yok) | — | — |
| 14 | Garanti | OKUNAMADI (kamu malı beyanı dışında garanti cümlesi okunmadı) | — | — |

**Teknik not:** `zone.tab` başlığı dosyayı "deprecated version / backward-compatibility aid" olarak tanımlar (yeni programlar `zone1970.tab` kullanmalı). `zone1970.tab` birden çok ülkeyi tek satırda ve kümelenmiş (1970'ten beri aynı saatli) bölge kimlikleriyle verir (ör. Norveç için `Europe/Berlin`), `zone.tab` ise ülke başına tek satır ve bilinen kimlikler (`Europe/Oslo`) verir; kullanıcıya dönük çıktı için `zone.tab` seçildi. Dosya kaldırılırsa `check:sources` sözleşme denetimi (`parseZoneTab`: ≥200 ülke, satır düzeni) hata verir. Sürüm: `tzdb/version` (ör. `2026e`).

## Karar
**🟢** (kamu malı). Açık: `zone.tab`'ın kaldırılma riski (sözleşme denetimi yakalar); okunamayan satırlar kamu malı beyanıyla önemsiz.
