# Türkiye kaynakları – doğrulama durumu

Son kontrol: bu depoyu geliştiren bulut konteynerinden (kurum siteleri erişim kısıtlı olabilir). **Aşağıdaki "erişilemedi" satırları kullanıcı ağından tekrar denenmeli.**

| Kaynak | Veri | Erişim (konteynerden) | Durum |
|---|---|---|---|
| Eurostat GISCO `NUTS_AT_2024.csv` | İBBS/NUTS: 12 NUTS1, 26 NUTS2, 81 NUTS3 (il) | ✅ 200 | **Kullanılıyor** (`gisco-nuts`). Tek dosya 39 ülkeyi içerir (TR dahil). |
| TÜİK (tuik.gov.tr) | İl/ilçe kodları, ADNKS nüfus | ⚠️ kesintili | Aşama C: indirme biçimi ve lisans doğrulanacak |
| data.gov.tr | Kurum açık veri setleri | ❌ erişilemedi | Doğrulanacak |
| NVİ UAVT/MAKS (adres.nvi.gov.tr) | İl, ilçe, mahalle, sokak, bina | ❌ erişilemedi | Toplu indirme yok/başvuru gerekebilir; lisans belirsiz. **Doğrulanmadan kullanılmaz.** |
| Resmî Gazete | İdari yapı değişiklikleri | ✅ 200 | İzleyici henüz yok (Aşama C) |
| mevzuat.gov.tr | 2429 sayılı Kanun metni | ❌ erişilemedi | Tatil kayıtlarındaki atıf bu kaynağa; metin **doğrulanmadı** |
| Diyanet dini günler takvimi | Ramazan/Kurban Bayramı tarihleri | ❌ erişilemedi (403) | Tarihler `date.nager.at` ile çapraz kontrol edilerek girildi, **`verification: unverified`**; 2027+ `tentative` |

## Tatil verisi: şu anki gerçek durum
`data/holidays/TR.json` içindeki tüm kayıtlar `unverified`. Tarihler 2024–2026 için bilinen takvimle tutarlı, 2027–2028 tahmindir. Resmi kaynakla satır satır doğrulanıp `verification: "verified"` yapılana kadar ürün tarafında "resmi doğrulanmış" iddiası kullanılmamalıdır.
