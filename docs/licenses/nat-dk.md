# Lisans dossier'i: nat-dk

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-06 (ajan okuması + bağımsız ikinci geçiş: lisans cümlesi ve CSV yeniden çekildi)
- **Yayıncı / veri seti:** Danmarks Statistik — sınıflama «Regions, provinces and municipalities» (`NUTS_V1_2007_DK`), sayfa `https://www.dst.dk/en/Statistik/dokumentation/nomenklaturer/nuts`; CSV bağlantısı sayfadan çözülür (`…/klassifikationsbilag/<guid>csv_en`, GUID revizyonla değişebilir).
- **Kullandığımız alanlar:** `CODE`, `LEVEL`, `TITLE`. Üst birim `LEVEL` + satır sırasından türetilir. 5 bölge, 11 landsdel, 99 belediye düzeyi satırı (98 kommune + Christiansø, devlet idaresinde; sınıflama aynı düzeyde listeler).

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL |
|---|---|---|---|---|
| 1 | Lisans | Yayıncının serbest yeniden kullanım beyanı (CC BY adı geçmiyor) | "Du må frit gengive Danmarks Statistiks indhold fra dst.dk og statistikbanken.dk. Det gælder også ved kommerciel brug. Men husk at angive os som kilde." | https://www.dst.dk/da/presse/kildeangivelse |
| 2–5 | Ticari kullanım, yeniden dağıtım, türev/API satışı, alt-lisans | evet, kaynak gösterilerek ("Det gælder også ved kommerciel brug") | (aynı) | (aynı) |
| 6 | Atıf | "Source: Danmarks Statistik (dst.dk)"; DST logosu kullanılamaz (aynı sayfa) | — | — |
| 7–8 | Share-alike / non-commercial | yok | — | — |
| 9 | Üçüncü taraf | OKUNAMADI | — | — |
| 11 | ToS / indirme | statik CSV, kimlik yok; hız limiti OKUNAMADI | — | — |
| 12–16 | Veritabanı hakkı, kişisel veri (yok), garanti, şart değişikliği, ihracat | OKUNAMADI / uygulanmaz | — | — |

**Resmî sayı kanıtı:** sınıflama sayfası: "Of the 98 municipalities, 32 municipalities retained the same municipal code and title before and after the reform." → 98 kommune (+ Christiansø = 99 satır; adaptör 95–105 bandı).
**Güncellik:** sınıflama "Valid from: January 1, 2007", bitiş yok (güncel); StatBank FOLK1A tablosu aynı kodları kullanıyor ve 2026-08-10'da güncellenmiş. CSV'nin kendisinde tarih alanı yok.
**Teknik not:** DAWA (api.dataforsyningen.dk) HTTP 410 "Gone" → kullanılamaz.

## Karar
**🟢** (serbest ticari yeniden kullanım + kaynak gösterimi). Açık: lisans cümlesi basın/kaynak gösterimi sayfasında (sınıflama sayfasında değil) — kapsamı "dst.dk içeriği" olarak geniş; avukat maddesi.
