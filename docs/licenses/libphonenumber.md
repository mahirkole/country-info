# Lisans dossier'i: libphonenumber

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-05
- **Yayıncı / veri seti:** Google libphonenumber, `resources/PhoneNumberMetadata.xml` (`https://raw.githubusercontent.com/google/libphonenumber/master/resources/PhoneNumberMetadata.xml`).
- **Kullandığımız alanlar:** her `<territory>` için `id` (ISO alfa-2; `001` atlanır), `countryCode`, `internationalPrefix`, `nationalPrefix`, `mainCountryForCode`. Numara kalıpları, biçimler, örnek numaralar alınmaz.

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL |
|---|---|---|---|---|
| 1 | Lisans | Apache License 2.0 | Dosya başlığı: "Copyright (C) 2009 The Libphonenumber Authors. Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License." ; repo `LICENSE`: "Apache License Version 2.0, January 2004" | PhoneNumberMetadata.xml ; https://raw.githubusercontent.com/google/libphonenumber/master/LICENSE |
| 2–5 | Ticari kullanım, yeniden dağıtım, türev/API satışı, alt-lisans | Apache-2.0 genel koşulları (ticari kullanım ve türev çalışma serbest; dağıtımda lisans kopyası ve bildirimler korunur). Lisans metninin ilgili maddeleri bu oturumda satır satır alıntılanmadı (OKUNAMADI: madde 4 alıntısı) | — | LICENSE |
| 6 | Atıf | `sources.attribution`: "Telephone metadata derived from Google libphonenumber (Apache License 2.0), © The Libphonenumber Authors." Lisans metni ATTRIBUTION.md ile dağıtılır | — | — |
| 7–8 | Share-alike / non-commercial | yok (Apache-2.0) | — | — |
| 9 | Üçüncü taraf | OKUNAMADI (NOTICE dosyası depoda 404; numara planı verisinin ülke düzenleyicileriyle ilişkisi okunmadı). Aldığımız alanlar olgusaldır (arama kodu, önek) | — | — |
| 10 | Marka | OKUNAMADI | — | — |
| 11 | ToS / indirme | statik dosya (GitHub raw), kimlik doğrulama yok | — | — |
| 12–16 | Veritabanı hakkı, kişisel veri (yok), garanti, şart değişikliği, ihracat | OKUNAMADI / uygulanmaz | — | — |

**Teknik not:** `master` dalı kayan bir kaynaktır (sürüm etiketi yok); `refresh`/`enrich:attributes` her çalışmada dosyayı çeker, içerik farkı sürüm notu üretir. Sözleşme denetimi `parsePhoneMetadata` (≥200 bölge, geçerli `countryCode`). GeoNames `phone_code` alanıyla çelişki varsa API iki kaynağı da gösterir (`contact` ve `telephony` scope'ları).

## Karar
**🟡 (Apache-2.0 başlığı okundu; 4. madde ve NOTICE okunamadı; `license_verdict` amber).** Ticari pakette bildirimin taşınması şartıyla kullanılır; avukat maddesinde Apache-2.0 bildirim yükümlülüğü teyit edilir.
