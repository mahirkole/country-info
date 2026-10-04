# Resmi tatil kaynakları – AB27 durumu (son kontrol: 2026-10-04)

`verified` = atıf yapılan metin resmi siteden okundu (`source.checked_on` dolu). `unverified` = metin okunamadı veya ayrıca teyit gerekiyor.

| Ülke | Dosya | Okunan resmi kaynak | Doğrulanan | Eksik / not |
|---|---|---|---|---|
| AT | `AT.json` | RIS – Arbeitsruhegesetz § 7 Abs. 2 | 13/13 | Paskalya/Pfingsten Pazarları listede yok (zaten dinlenme günü). |
| DE | `DE.json` | gesetze-im-internet.de – Einigungsvertrag Art. 2 Abs. 2 | 1/9 (3 Ekim) | Diğer 8 gün Länder yasalarında; tek tek okunmadı. **Bölgesel tatiller (6 Ocak, Fronleichnam, 1 Kasım, Reformationstag vb.) eklenmedi.** |
| ES | `ES.json` | BOE – RDL 2/2015 (Estatuto de los Trabajadores) art. 37.2 | 4/4 | Yasa yalnızca 4 ulusal günü sabitler (1 Ocak, 1 Mayıs, 12 Ekim, 25 Aralık). Diğer günler (6 Ocak, Viernes Santo, 15 Ağustos, 1 Kasım, 6 ve 8 Aralık) her yıl hükümet/özerk topluluk kararıyla belirlenir; **yıllık BOE çalışma takvimi eklenmeli**. |
| IT | `IT.json` | Normattiva – DPR 792/1985 art. 1 (dini günler) | 6/11 | 25 Nisan, 1 Mayıs, 2 Haziran, Paskalya Pazartesi, 26 Aralık: Legge 260/1949 metni sayfadan çıkarılamadı → `unverified`. 4 Ekim (San Francesco) 2026'dan itibaren yeni; tatil günü olup olmadığı **doğrulanmadı, eklenmedi**. |
| TR | `TR.json` | – (mevzuat.gov.tr, Diyanet erişilemedi) | 0 | Bkz. `docs/sources/TR.md`. |
| FR | – | Légifrance 403 | – | Eklenmedi. |
| NL | – | wetten.overheid.nl erişilemedi | – | Eklenmedi. |
| Kalan 19 ülke | – | Denenmedi | – | Eklenmedi. |

## `npm run check:holidays` (Nager.Date alarmı) bulguları – 2026
- AT: yalnızca Paskalya/Pfingsten **Pazarı** farkı (beklenen).
- DE, TR: fark yok.
- ES: yıllık takvimle belirlenen 6 gün fark (beklenen, yukarıdaki not).
- IT: Paskalya Pazarı ve 4 Ekim farkı.
Bu araç yalnızca uyarı verir; veri Nager.Date'ten **kopyalanmaz**.
