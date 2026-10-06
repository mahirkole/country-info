# Lisans dossier'i: libaddressinput

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-06
- **Yayıncı / veri seti:** Google libaddressinput — Address Data Service, `https://chromium-i18n.appspot.com/ssl-address/data[/<CC>]` (JSON; ülke başına bir kayıt, kararlı URL).
- **Kullandığımız alanlar:** ülke düzeyi kayıt: `zip` (posta kodu deseni), `zipex` (örnekler), `zip_name_type`, `postprefix`, `fmt` (adres düzeni), `require`, `upper`, `state_name_type`, `locality_name_type`, `posturl`. Alt bölge anahtarları (`sub_keys`, `sub_names`, `sub_zips`…) ve diller alınmaz. Kişisel veri yok.

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL |
|---|---|---|---|---|
| 1 | Lisans | CC BY 4.0 (veri); kaynak kod Apache-2.0 | Hizmet sayfası: "Copyright 2021 Google LLC. This data is licensed by Google under the CC-BY 4.0 license." (bağlantı creativecommons.org/licenses/by/4.0/) ; depo README: "Source code licensed under the Apache 2.0. Data licensed under the CC-BY 4.0" | https://chromium-i18n.appspot.com/ssl-address ; https://raw.githubusercontent.com/google/libaddressinput/master/README.md |
| 2–5 | Ticari kullanım, yeniden dağıtım, türev/API satışı, alt-lisans | CC BY 4.0 genel koşulları: ticari kullanım ve değiştirilmiş yeniden dağıtım serbest, atıf ve değişiklik belirtme şartıyla. CC BY 4.0 yasal metni bu oturumda yeniden alıntılanmadı (başka dossier'lerde okunmuş standart metin) | — | https://creativecommons.org/licenses/by/4.0/ |
| 6 | Atıf | `sources.attribution`: "Postal-code and address-format metadata extracted and reformatted from the Google libaddressinput Address Data Service, © Google LLC, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)." (değişiklik: yalnızca ülke düzeyi alanlar çıkarıldı, yeniden biçimlendirildi) | — | — |
| 7–8 | Share-alike / non-commercial | yok (CC BY) | — | — |
| 9 | Üçüncü taraf | Veri, ülke posta idarelerinden derlenmiştir; kaynakların ayrı hakları OKUNAMADI. Alanlar olgusal desen ve örneklerdir | — | — |
| 11 | ToS / hız limiti | Hizmetin kullanım şartları OKUNAMADI; kimlik doğrulama yok. Önlem: ülke başına bir istek, 6 paralel, yanıtlar önbelleğe alınır (aylık çalışma) | — | — |
| 12–16 | Veritabanı hakkı, kişisel veri (yok), garanti, şart değişikliği, ihracat | OKUNAMADI / uygulanmaz | — | — |

**Teknik not:** `chromium-i18n.appspot.com/ssl-address/data` ülke listesini (`countries: "AC~AD~..."`), `/data/<CC>` her ülke kaydını verir; çok dilli ülkelerde `--<dil>` anahtarları vardır (alınmaz, varsayılan kayıt). `check:sources` sözleşme denetimi: ≥200 ülke, `key`/`id` alanı. Eski GeoNames `postal_code` (regex+format) `contact` scope'unda kalır; `postal` scope'u daha zengindir (örnekler, zorunlu alanlar, adres düzeni).

## Karar
**🟢** (CC BY 4.0, atıfla). Açık: hizmet kullanım şartları ve alt kaynak hakları okunamadı (avukat maddesi, kapsam dar: desen/düzen olguları).
