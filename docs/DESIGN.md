# Tasarım

## Hedef
Dünyadaki tüm yerleşim hiyerarşisini (ülke → eyalet → şehir → mahalle → sokak) ve zamanla bölgeye bağlı nitelikleri (tatiller, yerel diller, para birimi, özel günler, posta kodları) sunmak; verinin değişimini izleyip delta olarak yayınlamak. İlk kapsam: BM'nin tanıdığı ülke ve bölgeler.

## Veri modeli
Tek bir hiyerarşik tablo (`entities`): `id`, `kind`, `parent_id`, `country_code`, `code`, `name`, `lat/lon`, `data jsonb`.
- Yeni seviyeler (şehir, mahalle, sokak) yeni `kind` değeridir; şema değişmez.
- Yeni nitelikler (tatil, özel gün, posta kodu) şimdilik `data` içine eklenebilir; hacmi büyüdüğünde kendi tablosuna (`entity_id`, `valid_from/to`) taşınır. Tatiller tarihe/yıla bağlı olduğundan ayrı tablo önerilir.
- Kimlikler kararlıdır: `country:TR`, `gn:<geonameid>`. Kod/isim değişse bile kimlik sabit kalır.

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
