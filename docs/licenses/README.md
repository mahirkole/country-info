# Lisans dossier indeksi (2026-10-04)

Her dosya `TEMPLATE.md` yapısındadır; alıntılar yayıncı sayfasından okunmuş, bağımsız ikinci geçişte (URL'ler yeniden çekilip alıntılar kaynakta arandı) kontrol edilmiştir. **Hukuki görüş değildir; ticari lansman öncesi avukat onayı şarttır.** Satılan çıktı yalnızca 🟢/🟡 kaynakları içerir (`npm run export -- --commercial`).

| Kaynak | Karar | Özet / sonraki adım |
|---|---|---|
| geonames | 🟡 | CC BY 4.0, ticari serbest; 100+ üst kaynağın lisansı listede yok → yazışma |
| gisco-nuts | 🟡 | Eurostat genel politika ticari serbest; NUTS sayfasında kendi cümlesi yok → yazışma |
| **gisco-lau** | **🔴** | "Specific download rules" okunamadı; communes ailesi ticari yasak → **satılmaz** |
| **un-m49** | **🔴** | BM şartları: ticari olmayan, yeniden satış/türev yok → **izin gelmeden kullanılmaz** |
| iana-tld | 🟡 | CC0 beyanı TLD listesini kapsamıyor → yazışma |
| nat-us | 🟡 | Federal eser (17 U.S.C. § 105); FTP için açık ticari cümle yok |
| nat-fr | 🟡 | INSEE Licence Ouverte 2.0 (ticari serbest) ajan tarafından okundu, ben etalab metnini bağımsız doğrulayamadım; **INSEE'den doğrudan alma** önerisi |
| nat-it | 🟢 | ISTAT CC BY 4.0. **Veri tazeliği:** CSV bayat (Ocak 2024), xlsx kullanılıyor |
| nat-nl | 🟡 | CBS tablo metaverisi "mits CBS als bron"; CC BY 4.0 site geneli |
| nat-no | 🟢 | CC BY 4.0 (veri seti kayıtları); API kaydı "Arkivert"; yeni host api.kartverket.no |
| nat-se | 🟢 | SCB CC0 (kendi okumam); PxWebApi v2 kullanılıyor |
| nat-gb | 🟡 | OGL v3 ticari serbest; "Names and Codes" tablolarının OS/Royal Mail kapsamı belirsiz |
| nat-au | 🟢 / 🟡 | ABS yapıları CC BY 4.0 (🟢); LGA üçüncü taraf mı belirsiz (🟡) |
| nat-de | 🟢 (koşullu) | Destatis telif sayfası ticari yeniden kullanım serbest (kendi okumam); BKG VG250 dl-de/by-2-0; AdV/ZSGT ürünleri ücretli, kullanılmaz |
| nat-es | 🟡 | INE ticari serbest ama yalnızca kaynağı INE olan içerik; belediye adları Bakanlık REL kaynaklı |
| nat-at | 🟢 | Statistik Austria CC BY 4.0 + AGB §10; PLZ/sokak dosyaları hariç |
| nat-be | ⚪ | Statbel CAPTCHA, metin okunamadı → insan okuması |
| nat-fi | 🟢 | Tilastokeskus CC BY 4.0, sınıflandırma API'si (308 belediye) |
| nat-dk | 🟡 | DAWA kapandı (410); DAGI CC BY 4.0 ama hesap/kararsız uç nokta |
| nat-pl | 🟡 | TERYT ücretsiz; lisans adı yok, CC BY yalnızca dane.gov.pl'de |
| nat-ie | 🟢 | CC BY 4.0; veri ince (31 il/şehir, resmi kod yok) |
| nat-pt | 🟢 | DGT CAOP CC BY 4.0; freguesia kodu INE'ye ait |
| nat-cz | 🟢 | ČÚZK/ČSÚ CC BY 4.0 (atıf + metaveri + değişiklik belirtme) |
| official-holidays | 🟡 | 8 ülkede (AT, CZ, DE, ES, HU, IT, PL, SE) mevzuat telif dışı/yeniden kullanım okundu; LV/HR işaretli; 12 ülke okunamadı |
| nat-ca, nat-jp, nat-ch, nat-kr, nat-br, nat-in, nat-tr | araştırılıyor | ajan sürüyor |
