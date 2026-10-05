# Türkiye kaynakları – doğrulama durumu

Son kontrol: bu depoyu geliştiren bulut konteynerinden (kurum siteleri erişim kısıtlı olabilir). **Aşağıdaki "erişilemedi" satırları kullanıcı ağından tekrar denenmeli.**

| Kaynak | Veri | Erişim (konteynerden) | Durum |
|---|---|---|---|
| Eurostat GISCO `NUTS_AT_2024.csv` | İBBS/NUTS: 12 NUTS1, 26 NUTS2, 81 NUTS3 (il) | ✅ 200 | **Kullanılıyor** (`gisco-nuts`). Tek dosya 39 ülkeyi içerir (TR dahil). |
| TÜİK (tuik.gov.tr) | İl/ilçe kodları, ADNKS nüfus | ⚠️ kesintili | Aşama C: indirme biçimi ve lisans doğrulanacak |
| data.gov.tr | Kurum açık veri setleri | ❌ erişilemedi | Doğrulanacak |
| NVİ UAVT/MAKS (adres.nvi.gov.tr) | İl, ilçe, mahalle, sokak, bina | ❌ erişilemedi | Toplu indirme yok/başvuru gerekebilir; lisans belirsiz. **Doğrulanmadan kullanılmaz.** |
| Resmî Gazete | İdari yapı değişiklikleri | ✅ 200 | İzleyici henüz yok (Aşama C) |
| mevzuat.gov.tr | 2429 sayılı Kanun metni | ✅ 200 (2026-10-05; PDF `mevzuatmetin/1.5.2429.pdf`) | **Okundu** (m.1, m.2/A–D; konsolide, 6752/2016 değişikliğine kadar). Sabit günler `verified` |
| Diyanet «Dini Günler» (vakithesaplama.diyanet.gov.tr/dinigunler.php?yil=YYYY) | Ramazan/Kurban Bayramı ve arefe tarihleri | ✅ 200 (2026-10-05) | 2024, 2025, 2026 sayfaları **okundu**; 18 tarih mevcut dosyayla satır satır aynı → `verified`. 2027–2028 sayfaları boş (Diyanet yayımlamadı) → `tentative` |
| tuik.gov.tr, cylaw.org, resmigazete.gov.tr | — | ✅ 200 (2026-10-05) | TÜİK hâlâ lisans/biçim doğrulaması bekliyor (veri alınmadı) |

## Tatil verisi: şu anki gerçek durum (2026-10-05)
`data/holidays/TR.json`: 8 sabit gün (1 Ocak, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz [2017'den], 30 Ağustos, 28 Ekim yarım gün, 29 Ekim) **2429 sayılı Kanun metninden okunarak `verified`**. Dini bayramlar (Ramazan: arefe + 3 gün; Kurban: arefe + 4 gün — süreler Kanun m.2/B'den) için 2024–2026 tarihleri Diyanet tablosundan okunarak `verified`; 2027–2028 `tentative` (Diyanet yayımlayınca her yıl Eylül'de `listed` tarihleri güncellenip `verified` yapılır). Not: Kanun m.2 "Cuma akşamı sona eren tatil Cumartesi'nin tamamını kapsar" hükmünü içerir; idari izin/köprü günleri (Cumhurbaşkanlığı kararları, Resmî Gazete) bu dosyada **yoktur**.
