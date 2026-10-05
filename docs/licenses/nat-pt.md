# Lisans dossier'i: nat-pt

> Hukuki görüş değildir. Yalnızca yayıncı sayfasından **okunan** metin alıntılanır. Okuyan: Claude, 2026-10-05; bağımsız ikinci geçiş yapılmadı.

- **Yayıncı / veri seti:** Direção-Geral do Território (DGT) — CAOP2025 (Carta Administrativa Oficial de Portugal), OGC API `https://ogcapi.dgterritorio.gov.pt/collections/{distritos,municipios,freguesias}`; yalnızca öznitelik (geometri `skipGeometry=true` ile alınmaz).
- **Kapsam:** Yalnızca Continente (18 distrito / 278 município / 3.049 freguesia). Açores ve Madeira (30 belediye) OGC API'de yok; yalnızca gpkg zip olarak yayımlanıyor (okunmadı) → eksik, GeoNames/Wikidata katmanı kalır.

| # | Soru | Cevap | Kanıt |
|---|---|---|---|
| 1 | Lisans | CC BY 4.0 | DGT "Dados abertos": "A informação geográfica descarregada do Centro de Dados está sujeita a uma licença de utilização CC-BY 4.0, que permite a utilização livre e gratuita dos dados tendo apenas como obrigação a menção de que a entidade proprietária da informação é a Direção-Geral do Território." — https://www.dgterritorio.gov.pt/dados-abertos ; dados.gov.pt veri seti kaydı CAOP2025 (Continente): `cc-by` (Direção-Geral do Território) |
| 2 | Ticari kullanım | evet ("livre e gratuita") | aynı metin |
| 3-5 | Yeniden dağıtım / türetilmiş DB / alt-lisans | CC BY 4.0 gereği evet; sayfada ayrıca yazılmadı | CC BY 4.0 metni okunmadı (standart lisans) |
| 6 | Atıf | "Fonte: Direção-Geral do Território (DGT), Carta Administrativa Oficial de Portugal (CAOP). CC BY 4.0" | sayfa: yalnızca DGT'nin sahip olarak anılması şartı |
| 7-8 | SA / NC | yok | — |
| 11 | ToS / hız limiti | OKUNAMADI; OGC API kimlik doğrulamasız, sayfalı (1000/sayfa) | — |
| 13 | Kişisel veri | yok (kod, ad, alan) | — |

**Boşluk:** Sayfa lisansı "Centro de Dados" indirmeleri için yazıyor; OGC API aynı sayfada "disponíveis através de OGC API" diye sıralanıyor ama lisans cümlesi API için ayrıca yinelenmiyor → adaptör `partial`, karar 🟡.

## Güncelleme bilgisi
Yıllık CAOP (2025 sürümü; sürüm koleksiyon başlığında `CAOP2025`). CSV çıktı kullanılır (GeoJSON zarfındaki `timeStamp` ham-girdi hash'ini bozar).

## Karar
- **🟡 şartlı** — CC BY 4.0 açıkça yazılı; API için ayrı lisans cümlesi ve Açores/Madeira eksik.
