# Tasarım

## Hedef
Dünyadaki tüm yerleşim hiyerarşisini (ülke → eyalet → şehir → mahalle → sokak) ve zamanla bölgeye bağlı nitelikleri (tatiller, yerel diller, para birimi, özel günler, posta kodları) sunmak; verinin değişimini izleyip delta olarak yayınlamak. İlk kapsam: BM'nin tanıdığı ülke ve bölgeler.

## Veri modeli
Tek bir hiyerarşik tablo (`entities`): `id`, `kind`, `parent_id`, `country_code`, `code`, `name`, `lat/lon`, `data jsonb`.
- Yeni seviyeler (şehir, mahalle, sokak) yeni `kind` değeridir; şema değişmez.
- Yeni nitelikler (tatil, özel gün, posta kodu) şimdilik `data` içine eklenebilir; hacmi büyüdüğünde kendi tablosuna (`entity_id`, `valid_from/to`) taşınır. Tatiller tarihe/yıla bağlı olduğundan ayrı tablo önerilir.
- Kimlikler kararlıdır: `country:TR`, `gn:<geonameid>`. Kod/isim değişse bile kimlik sabit kalır.

## Scope'lar ve metadata (Faz 9)
`src/scopes/catalog.ts` (sürümlü `SCHEMA_VERSION`) her scope'un alanlarını, kaynağını ve ayrıntı düzeyini (`applies_to`: country/admin1/admin2/locality) tanımlar; `resolve.ts` her scope için bir çözücü içerir (test eşleşmeyi zorlar), `schema.ts` metadata (JSON Schema + `x-*`), kesişim/birleşim ve profil birleştirmeyi yapar. Ülke anahtarlı CLDR öznitelikleri `entity_attributes(entity_id, grp, data)`, yerel ayar anahtarlıları (tarih/saat/sayı kalıpları) `locale_formats` tablosundadır; ikisi de `enrich:cldr` ile her çalıştırmada baştan yazılır (el ile veri yok). Ülkenin yerel ayarı CLDR `likelySubtags`'tan (tek birincil dil; çok dilli ülkede `?locale=`). Öznitelik değişiklikleri (önceki yüklemeyle içerik farkı; ilk yükleme sayılmaz) değişiklik akışına da girer (`src/attribute-changes.ts`): kaynak başına bir snapshot, ülke başına bir `changes` satırı (`kind=attributes`, `entity_id=country:<CC>`, `changed_fields` = öznitelik grupları, before/after = grup içerikleri); `snapshot.completed` webhook'u `kinds: ["attributes"]` filtresiyle ve ayrıca `release.published` (kind `attributes`) gider. Locale biçimleri (`locale_formats`) ülke anahtarlı olmadığından yalnızca sürüm notunda sayılır. Sürüm farkı `vintage` alanındadır (`CLDR 48`). Kayıtlı profiller `scope_profiles` (anahtara ait). `export_countries` yalnızca dosya paketlerini sınırlar, API'yi değil.

## Güncelleme ve delta
1. Kaynaktan kanonik `EntityInput` listesi üretilir.
2. Her kaydın içeriği anahtar-sıralı JSON üzerinden SHA-256 ile özetlenir.
3. Tek transaction içinde (advisory lock ile tekil) mevcut özetlerle karşılaştırılır: insert / update / delete / unchanged.
4. Her değişiklik global `seq` ile `changes` tablosuna `before`/`after`/`changed_fields` ile yazılır; `snapshots` satırı özet sayıları tutar.
5. Aynı transaction'da webhook teslimatları kuyruğa alınır; işçi imzalı POST yapar.

Tüketiciler `seq` cursor'ı ile sıralı, kayıpsız delta alır. Dosya dağıtımında aynı delta `delta.ndjson` olarak bulunur.

## Kaynaklar ve lisans
| Seviye | Kaynak | Lisans |
|---|---|---|
| Ülke, para birimi, dil, telefon, posta biçimi | GeoNames `countryInfo.txt` | CC-BY 4.0 |
| BM üyelik durumu | `src/sources/un.ts` (193 üye + 2 gözlemci, elle bakımlı) | – |
| Admin1/admin2 | GeoNames `admin1CodesASCII`, `admin2Codes` | CC-BY 4.0 |
| Şehir | GeoNames `cities15000` (sonraki adım) | CC-BY 4.0 |
| Mahalle, sokak | OpenStreetMap (sonraki adım) | ODbL – atıf ve share-alike; türetilmiş veritabanını aynı lisansla paylaşma yükümlülüğü hukuken değerlendirilmeli |
| Posta kodları | GeoNames `postalCodes` (sonraki adım) | CC-BY 4.0 |
| Tatiller | Nager.Date / `date-holidays` (sonraki adım) | MIT; bölgesel kapsam ve doğruluk kontrol edilmeli |

## Çok kaynaklı model (Aşama A–B–D)
- Her `entity` tam bir `source_id`'ye aittir; `ingest()` yalnızca kendi kaynağının, verilen `kinds` (ve `countries`) kapsamındaki eksik kayıtlarını siler ve başka kaynağın kimliğini sahiplenemez.
- Aynı gerçek-dünya kavramı farklı kaynaklarda ayrı kayıttır (`gn:*` ↔ `nuts:*`); `npm run link` GeoNames admin1 ↔ NUTS eşlemesini ad üzerinden kurar: ülke başına en çok eşleşen NUTS seviyesi seçilir, birebir eşleşenler `entity_links`'e, belirsizler `review_items`'a gider (tahmin yok). Gerçek veride 770 admin1'den 169'u bağlandı, 0 belirsiz; kalan 601 çoğunlukla GeoNames'in İngilizce adlarından ("Bavaria" ↔ "Bayern") kaynaklanır. İyileştirme: `alternateNamesV2` veya ISO 3166-2 eşlemesi.
- `ingest()` kaynağın mevcut kayıtlarının %5'inden fazlası silinecekse (≥100 kayıtta) işlemi geri alır (`DeleteGuardError`); bilinçli toplu silme için `ALLOW_BULK_DELETE=1`.
- Tatiller `kind='holiday'` entity'leridir (`hol:<CC>:<tarih>:<kural>`); böylece delta/webhook/export aynen çalışır. Kurallar `data/holidays/<CC>.json` içinde, her kuralda atıf ve `verification` alanı (`verified|unverified|tentative`) bulunur.

## Bilinen sınırlar
- Admin kodları GeoNames kodlarıdır; **ISO 3166-2 değildir**. ISO 3166-2 eşlemesi ayrı bir kaynakla eklenmeli (`data.iso3166_2`).
- `population`/`area_km2` kaynakta sık değişir; delta'da gürültü yaratabilir. Gerekirse hash dışında tutulur.
- Eski bir snapshot id'si için `export` verisi, o anki veritabanı durumunu yansıtır; yalnızca `delta.ndjson` snapshot'a özeldir. Tam geçmiş durum gerekirse `changes` geri sarılarak veya snapshot başına arşivle üretilebilir.
- Bölge dışı geçici kaynak hatası ingest'i bütünüyle geri alır (atomik), kısmi veri yazılmaz. Kaynak eksik/bozuk gelirse toplu silme riski vardır: üretimde "silme oranı eşiği" korumasıyla çalıştırılmalı.

## Yol haritası
1. ISO 3166-2 eşlemesi, çok dilli adlar (GeoNames `alternateNamesV2`).
2. Şehirler (`cities15000`), ardından posta kodları.
3. Tatiller ve özel günler (`holidays` tablosu, bölge + yıl).
4. OSM mahalle/sokak: ülke bazlı PBF/Overpass hattı, bölgesel parçalı indirme.
5. Zamanlanmış ingest (cron), silme eşiği, API anahtarı ve hız sınırı, OpenAPI şeması.
