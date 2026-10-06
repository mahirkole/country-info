# Lisans dossier'i: nat-sk

> Hukuki görüş değildir. Yalnızca yayıncının kataloğundan **okunan** beyan alıntılanır.

- **Okuma tarihi:** 2026-10-06 (araştırma ajanı + ben bağımsız ikinci geçiş)
- **Yayıncı / veri seti:** Ministerstvo vnútra SR (legal-subject 00151866) – Register adries: «Register Adries - Register krajov / okresov / obcí» (CL000023/24/25), Národný katalóg otvorených dát (data.slovensko.sk / data.gov.sk).
- **Kullandığımız alanlar:** kod, ad, tür (status), üst birim bağı, geçerlilik tarihleri; adres/kişi verisi yok.

| # | Soru | Cevap | Kanıt | URL |
|---|---|---|---|---|
| 1 | Lisans | **CC0** (EU authority licence CC0) | Dağıtımın `termsOfUse` düğümü: `legislation/authorsWorkType`, `originalDatabaseType`, `databaseProtectedBySpecialRightsType` = `http://publications.europa.eu/resource/authority/licence/CC0` (SPARQL ile okundu; `personalDataContainmentType` = `…/personal-data-occurence-type/2`) | https://data.slovensko.sk/api/sparql (dağıtım https://data.slovensko.sk/download?id=de703e0a-074d-49ef-b140-96c2f6d170db) |
| 2–5 | Ticari kullanım, yeniden dağıtım, türev/API satışı, alt-lisans | evet (CC0: telif ve veritabanı hakkı feragat/kapsam dışı) | yukarıdaki üç hak türü de CC0 | aynı |
| 6 | Atıf | zorunlu değil; nezaket atfı kullanıyoruz: «Source: Ministerstvo vnútra Slovenskej republiky, Register adries (open data, CC0)» | — | — |
| 7–8 | Share-alike / NC | yok | CC0 | — |
| 9 | Üçüncü taraf hakları | belirtilmemiş | — | — |
| 13 | Kişisel veri | idari birim adları/kodları; kişi verisi yok | — | — |
| 15 | Şart değişikliği | yükleyici her çalışmada dağıtımın CC0 beyanını kontrol eder; CC0 dışı → yükleme durur; katalog SPARQL sayfası `check:licenses` ile izlenir | — | — |

**Veri notları:** dosya «Obce - inicializačné a zmenové dáta» (son değişiklik 2024-05-22; seri `accrualPeriodicity=IRREG`). Geçerli sürüm (validFrom ≤ bugün ≤ validTo, kod başına en yüksek versionId) alınır; yer tutucu satırlar (`NEDODANE`, `100000 Neznáma`) atılır. Sonuç: 8 kraj, 79 okres, 2.928 obec/mesto/mestská časť/vojenský obvod (3.015 kayıt). Resmî toplam sayıyla **karşılaştırılmadı** (kayıt Mayıs 2024 tarihli; sonraki değişiklik dosyası yok). Karar: 🟢.
