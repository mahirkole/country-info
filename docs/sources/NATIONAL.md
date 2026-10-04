# Ulusal resmi kaynaklar (ülke başına ayrı adaptör)

Yaklaşım: her ülkenin kendi resmi verisi, `src/sources/national/<cc>.ts` içinde ayrı adaptör; çıktı `division` kayıtları (`div:<CC>:<kod>`) ve ortak sözlük (`src/taxonomy.ts`: state, province, region, prefecture, canton, county, district, department, municipality, commune, borough, parish, ward, neighbourhood, street, other). Her kayıtta `data.level` (1 = ülkenin altındaki ilk seviye), `data.type` (ortak sözlük) ve `data.type_local` (yerel ad: "département", "Parish"…).

Yeni ülke eklerken sıra: (1) yayıncının lisans metnini oku → `docs/LICENSES.md`; (2) adaptör + test; (3) `NATIONAL` kaydına ekle; (4) bu tabloyu güncelle. `licenseStatus: 'unread'` olan kaynak yüklenmez.

## Durum (son kontrol: 2026-10-04, bu konteynerden)

| Ülke | Kaynak | Seviyeler | Erişim | Lisans | Durum |
|---|---|---|---|---|---|
| US | Census Bureau ANSI/FIPS codes 2020 | state, county (+parish, borough, independent city, municipio) | ✅ | partial (17 U.S.C. § 105; sayfada açık "public domain" ifadesi bulunamadı) | **Yüklü: 3.292 birim** |
| FR | INSEE COG via geo.api.gouv.fr | region, department, commune | ✅ (proxy'de kesintili, yeniden deneme var) | partial ("Toutes les données… Open Data"; INSEE lisans metni bulunamadı; API OSM ortağını da listeliyor, yalnızca INSEE adları/kodları/nüfusu alınıyor) | **Yüklü: 35.088 birim** |
| CH | BFS Amtliches Gemeindeverzeichnis (`agvchapp.bfs.admin.ch/api/communes/snapshot`) | canton, district, municipality (hiyerarşi içinde) | ✅ | **unread:** opendata.swiss paket metaverisinde lisans alanı boş; 4 kullanım şartından hangisi olduğu okunamadı | **Bloklu** (lisans) |
| IT | ISTAT Elenco dei comuni italiani (**xlsx**, güncel; CSV bayat) | region, province/UTS, comune (+ NUTS 2024) | ✅ | **read** (CC BY 4.0) | **Yüklü: 8.024** (20 / 110 / 7.894; 21.02.2026 durumu, Sardinya yeniden yapılanması delta olarak yakalandı) |
| JP | MIC/Soumu 全国地方公共団体コード (xlsx) | prefecture, municipality | ✅ | okunmadı | Sırada (xlsx ayrıştırıcı gerekir) |
| NL | CBS StatLine 86247NED "Gebieden in Nederland 2026" | landsdeel, provincie, gemeente | ✅ (Node istemcisi 406 alıyor, curl yedeği kullanılıyor) | partial (CBS web sitesi CC BY 4.0; OData tablosuna ayrı lisans metni bulunamadı) | **Yüklü: 358 birim** (4 / 12 / 342) |
| NO | Kartverket kommuneinfo (api.kartverket.no) | fylke, kommune | ✅ | **read** (CC BY 4.0 veri seti kayıtları; API kaydı "Arkivert") | **Yüklü: 372** (15 / 357) |
| SE | SCB PxWebApi v2 (yıllık tablo otomatik keşfedilir) | län, kommun | ✅ | **read** (CC0) | **Yüklü: 311** (21 / 290), `TAB6646` |
| GB | ONS Open Geography (ArcGIS REST) | country, region, county, district | ✅ | 🟡 OGL v3 (dossier) | OS/Royal Mail kapsamı teyidinden sonra |
| AU | ABS ASGS | state, SA4…SA1 | ✅ | 🟢 yapılar CC BY 4.0 / 🟡 LGA | Sırada (Edition 4) |
| DK | DAWA (`api.dataforsyningen.dk`) | region, municipality | ❌ 410 (adres değişmiş) | – | Yeni adres araştırılacak |
| CA | Statistics Canada | province, census division, subdivision | ❌ 403 | – | Başka erişim yolu |
| TR | TÜİK, NVİ (UAVT/MAKS) | il, ilçe, mahalle, sokak | ❌ | – | Kullanıcı ağı gerekir |
| EU27 | Eurostat GISCO NUTS/LAU | nuts1-3, lau | ✅ | read | **Yüklü** (`gisco-*`) |
| Diğer | – | – | – | – | Araştırılmadı |

## Dossier sonrası ek adaylar (lisans 🟢, ayrıntı `docs/licenses/README.md`)
DE (Destatis GV-ISys xlsx / BKG VG250), AT (Statistik Austria), FI (Tilastokeskus API, 308 belediye), CZ (ČSÚ yapı CSV, ČÚZK), PT (DGT CAOP), AU yapıları. 🟡: GB, ES, DK, PL, NL (zaten yüklü). ⚪: BE (CAPTCHA).

## Tasarım notları
- GeoNames (`geonames`) hâlâ dünya geneli taban katman; ulusal kaynaklar `division` olarak **yanına** eklenir, GeoNames'i silmez. "Yalnızca resmi" mod için bkz. `docs/ROADMAP.md`.
- Ülkelerin düzey adları farklıdır: `type` ortak sözlükten seçilir, yerel ad `type_local`'e gider; karşılığı olmayan kavram için önce sözlüğe tür eklenir.
- Mahalle/sokak gibi alt seviyeler (TR NVİ, ülke adres kayıtları) aynı modelle eklenebilir (`level` 4, 5…, `type: neighbourhood|street`); hacim ve KVKK/GDPR nedeniyle ayrıca değerlendirilir.
