# Lisans dossier'i: nat-lu

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-06 (ajan okuması + bağımsız ikinci geçiş: XLSX ve veri seti sayfası yeniden çekildi)
- **Yayıncı / veri seti:** STATEC (Institut national de la statistique et des études économiques du Grand-Duché de Luxembourg) — «Codes LAU des communes du Grand-Duché de Luxembourg», data.public.lu; dosya `https://statistiques.public.lu/dam-assets/fr/donnees-autres-formats/territoire-environ-energie/territoire/A1106.xlsx`.
- **Kullandığımız alanlar:** kanton (LAU1, 12) ve komün (LAU2, 100) kodu ve adı, NUTS3 kodu. Nüfus/alan/geometri yok; kişisel veri yok.

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL |
|---|---|---|---|---|
| 1 | Lisans | Creative Commons Zero (CC0) | Veri seti sayfası: "License Creative Commons Zero (CC0)"; portal altbilgisi: "Unless otherwise stated, all content of this site is available under Creative Commons CC0 license." | https://data.public.lu/en/datasets/codes-lau-des-communes-du-grand-duche-de-luxembourg/ |
| 2–5 | Ticari kullanım, yeniden dağıtım, türev/API satışı, alt-lisans | serbest (CC0: kamu malına adanmış) | (aynı) | (aynı) |
| 6 | Atıf | gerekmez; nazik atıf `sources.attribution`: "Source: STATEC, LAU codes of the communes of Luxembourg (data.public.lu, CC0)" | — | — |
| 7–8 | Share-alike / non-commercial | yok | — | — |
| 9 | Üçüncü taraf | XLSX dosyasının kendisinde ayrı bir lisans cümlesi bulunamadı (yalnızca veri seti sayfasının CC0 alanı) → bu dossier'in en zayıf noktası | — | — |
| 11 | ToS / indirme | statik dosya, kimlik doğrulama yok | — | — |
| 12–16 | Veritabanı hakkı, kişisel veri (yok), garanti, şart değişikliği, ihracat | OKUNAMADI / uygulanmaz | — | — |

**Resmî sayı kanıtı:** XLSX `Index` sayfası: "LAU codes as of 01.09.2023 (100 municipalities)" ve "determined by the 12 cantons (LAU 1) and the different municipalities (LAU 2)" → 12 kanton, 100 komün (adaptör sayıları bu değerlerle kapılar).
**Güncelleme notu:** veri seti sayfası "Latest update August 16, 2022", "Update frequency not set"; dosyadaki güncel sayfa 01.09.2023 durumunu verir (sayfa adı `LU_SEP 2023` her baskıda değişir; adaptör sayfayı başlık satırından bulur). Yeni komün birleşmesi olursa dosya güncellenmeyebilir → `refresh` bandı ve yıllık sıklık.

## Karar
**🟢** (CC0). Açık: XLSX dosyası için ayrı lisans cümlesi yok (veri seti sayfasına dayanır); yayın sıklığı belirsiz.
