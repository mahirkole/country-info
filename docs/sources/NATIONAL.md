# Ulusal resmi kaynaklar (ülke başına ayrı adaptör)

Yaklaşım: her ülkenin kendi resmi verisi, `src/sources/national/<cc>.ts` içinde ayrı adaptör; çıktı `division` kayıtları (`div:<CC>:<kod>`) ve ortak sözlük (`src/taxonomy.ts`: state, province, region, prefecture, canton, county, district, department, municipality, commune, borough, parish, ward, neighbourhood, street, other). Her kayıtta `data.level` (1 = ülkenin altındaki ilk seviye), `data.type` (ortak sözlük) ve `data.type_local` (yerel ad: "département", "Parish"…).

Yeni ülke eklerken sıra: (1) yayıncının lisans metnini oku → `docs/LICENSES.md`; (2) adaptör + test; (3) `NATIONAL` kaydına ekle; (4) bu tabloyu güncelle. `licenseStatus: 'unread'` olan kaynak yüklenmez.

## Durum (son kontrol: 2026-10-04, bu konteynerden)

| Ülke | Kaynak | Seviyeler | Erişim | Lisans | Durum |
|---|---|---|---|---|---|
| US | Census Bureau ANSI/FIPS codes 2020 | state, county (+parish, borough, independent city, municipio) | ✅ | partial (17 U.S.C. § 105; sayfada açık "public domain" ifadesi bulunamadı) | **Yüklü: 3.292 birim** |
| FR | INSEE COG via geo.api.gouv.fr | region, department, commune | ✅ (proxy'de kesintili, yeniden deneme var) | partial ("Toutes les données… Open Data"; INSEE lisans metni bulunamadı; API OSM ortağını da listeliyor, yalnızca INSEE adları/kodları/nüfusu alınıyor) | **Yüklü: 35.088 birim** |
| CH | BFS Amtliches Gemeindeverzeichnis (`agvchapp.bfs.admin.ch/api/communes/snapshot`) | canton, district, municipality (hiyerarşi içinde) | ✅ | **unread:** opendata.swiss paket metaverisinde lisans alanı boş; 4 kullanım şartından hangisi olduğu okunamadı | **Bloklu** (lisans) |
| IT | ISTAT Elenco comuni italiani (CSV, `istat.it/storage/codici-unita-amministrative/`) | region, province/metropolitan city, comune | ✅ | okunmadı | Sırada |
| JP | MIC/Soumu 全国地方公共団体コード (xlsx) | prefecture, municipality | ✅ | okunmadı | Sırada (xlsx ayrıştırıcı gerekir) |
| NL | CBS StatLine OData | province, municipality | ✅ | okunmadı | Sırada |
| NO | Geonorge kommuneinfo API | county, municipality | ✅ | okunmadı | Sırada |
| SE | SCB PxWeb API | county, municipality | ✅ | okunmadı | Sırada |
| GB | ONS Open Geography (ArcGIS REST) | country, region, county, district | ✅ | okunmadı (OGL beklenir) | Sırada |
| AU | ABS ASGS | state, SA4…SA1 | ✅ (sayfa) | okunmadı | Sırada |
| DK | DAWA (`api.dataforsyningen.dk`) | region, municipality | ❌ 410 (adres değişmiş) | – | Yeni adres araştırılacak |
| CA | Statistics Canada | province, census division, subdivision | ❌ 403 | – | Başka erişim yolu |
| TR | TÜİK, NVİ (UAVT/MAKS) | il, ilçe, mahalle, sokak | ❌ | – | Kullanıcı ağı gerekir |
| EU27 | Eurostat GISCO NUTS/LAU | nuts1-3, lau | ✅ | read | **Yüklü** (`gisco-*`) |
| Diğer | – | – | – | – | Araştırılmadı |

## Tasarım notları
- GeoNames (`geonames`) hâlâ dünya geneli taban katman; ulusal kaynaklar `division` olarak **yanına** eklenir, GeoNames'i silmez. "Yalnızca resmi" mod için bkz. `docs/ROADMAP.md`.
- Ülkelerin düzey adları farklıdır: `type` ortak sözlükten seçilir, yerel ad `type_local`'e gider; karşılığı olmayan kavram için önce sözlüğe tür eklenir.
- Mahalle/sokak gibi alt seviyeler (TR NVİ, ülke adres kayıtları) aynı modelle eklenebilir (`level` 4, 5…, `type: neighbourhood|street`); hacim ve KVKK/GDPR nedeniyle ayrıca değerlendirilir.
