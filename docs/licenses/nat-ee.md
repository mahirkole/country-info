# Lisans dossier'i: nat-ee

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-06 (ajan okuması + iki lisans metni bağımsız ikinci geçişle yeniden çekilip bulundu)
- **Yayıncı / veri seti:** Maa- ja Ruumiamet (Estonian Land and Spatial Development Board) — "Administrative and settlement units" (EHAK katmanı); WFS `https://gsavalik.envir.ee/geoserver/ehak/ows` (katman `ehak:omavalitsuste_piirid`, yalnızca öznitelikler, geometri alınmaz).
- **Kullandığımız alanlar:** `ehak_kood`, `omavalitsus`, `maakond_kood`, `maakond`, `vers_lopp` (sona ermiş birimleri atlamak için). Yerleşim birimleri (`asustusüksused`, ~4.7 bin) alınmaz. Kişisel veri yok.

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL |
|---|---|---|---|---|
| 1 | Lisans | Kısıtlama yok, kaynak + geçerlilik tarihi atfı; hizmet düzeyinde CC BY 4.0 | Maa-amet veri sayfası: "Licence The use of administrative and settlement units data is not restricted, but the reference to the data source (i.e. Estonian Land and Spatial Development Board) and validity date must be made!" ; WFS GetCapabilities özeti (Estonca; İngilizce karşılığı ajan çıktısında): "Juhul kui kihi kohta pole eraldi tingimusi määratud, on siinolevad andmed avaldatud CC-BY 4.0 https://creativecommons.org/licenses/by/4.0/ litsentsi alusel viitega Kliimaministeeriumile kui andmete allikale." | https://geoportaal.maaamet.ee/eng/Spatial-Data/Administrative-and-Settlement-Division-p312.html ; https://gsavalik.envir.ee/geoserver/ehak/ows?service=WFS&version=2.0.0&request=GetCapabilities |
| 2–5 | Ticari kullanım, yeniden dağıtım, türev/API satışı, alt-lisans | evet ("not restricted" + CC BY 4.0 genel koşulları; ticari kullanım kısıtı yok) | (aynı) | (aynı) |
| 6 | Atıf | "Administrative and settlement units, Estonian Land and Spatial Development Board <validity date>" (sayfadaki örnek biçim) → `sources.attribution` kurum + CC BY 4.0 + "data as of the refresh date" | örnek: "Administrative and settlement units, Estonian Land and Spatial Development Board 01.01.2026" | veri sayfası |
| 7 | Share-alike | **yok.** Önceki «EHAK CC BY-SA» işareti hiçbir okunan metinde yeniden bulunmadı (klassifikaatorid.stat.ee EHAK sayfaları lisans belirtmiyor; avaandmed.eesti.ee kayıtlarında lisans alanı boş) | — | — |
| 8 | Non-commercial | yok | — | — |
| 9 | Üçüncü taraf / köken | Maa-amet nitelikleri İstatistik Estonya'nın EHAK sınıflamasından türemiş olabilir; İstatistik Estonya şartları okunamadı. Katman üst veri kaydı (metadata.geoportaal.ee/…/maaamet_haldus_asustus) 404 → katmana özgü ek koşul okunamadı | — | — |
| 11 | ToS / hız limiti | herkese açık WFS, kimlik yok; indirme dosyaları aylık güncellenir ("Downloadable files are updated monthly") | veri sayfası | — |
| 12–16 | Veritabanı hakkı, kişisel veri (yok), garanti, şart değişikliği, ihracat | OKUNAMADI / uygulanmaz | — | — |

**Teknik not:** katmanın `tyyp` alanı güvenilmez ("Haapsalu linn" için "vald"); tür ad sonekinden (`linn`/`vald`) çıkarılır. Gerçek çalıştırma: 78 belediye + 15 maakond = 93 kayıt. Resmî sayı beyanı bulunamadı (Riigi Teataja haldusüksuste nimistu JS-only) → adaptör 15 maakond ve 70–90 belediye bandında doğrular.

## Karar
**🟢** (kısıtlama yok + CC BY 4.0, share-alike yok). Açık: katman üst veri kaydı ve İstatistik Estonya kökeni okunamadı (avukat maddesi); resmî belediye sayısı metinle doğrulanamadı.
