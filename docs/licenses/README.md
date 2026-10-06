# Lisans dossier indeksi (2026-10-04)

Her dosya `TEMPLATE.md` yapısındadır; alıntılar yayıncı sayfasından okunmuş, bağımsız ikinci geçişte (URL'ler yeniden çekilip alıntılar kaynakta arandı) kontrol edilmiştir. **Hukuki görüş değildir; ticari lansman öncesi avukat onayı şarttır.** Satılan çıktı yalnızca 🟢/🟡 kaynakları içerir (`npm run export -- --commercial`).

| Kaynak | Karar | Özet / sonraki adım |
|---|---|---|
| geonames | 🟡 | CC BY 4.0, ticari serbest; 100+ üst kaynağın lisansı listede yok → yazışma |
| gisco-nuts | 🟡 | Eurostat genel politika ticari serbest; NUTS sayfasında kendi cümlesi yok → yazışma |
| **gisco-lau** | **🔴** | "Specific download rules" okunamadı; communes ailesi ticari yasak → **satılmaz** |
| **un-m49** | **🔴** | BM şartları: ticari olmayan, yeniden satış/türev yok → **izin gelmeden kullanılmaz** |
| iana-tld | 🟡 | CC0 beyanı TLD listesini kapsamıyor → yazışma |
| nat-us | 🟡 | Federal eser (17 U.S.C. § 105); FTP için açık ticari cümle yok |
| nat-fr | 🟢 | **INSEE COG CSV'leri** (Licence Ouverte 2.0; INSEE sayfası + Etalab metni bağımsız okundu): ticari serbest, "Source : Insee" + güncelleme tarihi; geo.api.gouv.fr bırakıldı |
| nat-it | 🟢 | ISTAT CC BY 4.0. **Veri tazeliği:** CSV bayat (Ocak 2024), xlsx kullanılıyor |
| nat-nl | 🟡 | CBS tablo metaverisi "mits CBS als bron"; CC BY 4.0 site geneli |
| nat-no | 🟢 | CC BY 4.0 (veri seti kayıtları); API kaydı "Arkivert"; yeni host api.kartverket.no |
| nat-se | 🟢 | SCB CC0 (kendi okumam); PxWebApi v2 kullanılıyor |
| nat-gb | 🟡 | OGL v3 ticari serbest; "Names and Codes" tablolarının OS/Royal Mail kapsamı belirsiz |
| nat-au | 🟢 / 🟡 | ABS yapıları CC BY 4.0 (🟢); LGA üçüncü taraf mı belirsiz (🟡) |
| nat-de | 🟢 (koşullu) | Destatis telif sayfası ticari yeniden kullanım serbest (kendi okumam); BKG VG250 dl-de/by-2-0; AdV/ZSGT ürünleri ücretli, kullanılmaz |
| nat-es | 🟡 | INE ticari serbest ama yalnızca kaynağı INE olan içerik; belediye adları Bakanlık REL kaynaklı |
| nat-at | 🟢 | Statistik Austria CC BY 4.0 + AGB §10; PLZ/sokak dosyaları hariç |
| nat-be | ⚪ | Statbel CAPTCHA, metin okunamadı → insan okuması |
| nat-fi | 🟢 | Tilastokeskus CC BY 4.0, sınıflandırma API'si (308 belediye) |
| nat-dk | 🟡 | DAWA kapandı (410); DAGI CC BY 4.0 ama hesap/kararsız uç nokta |
| nat-gr | 🟢 | ELSTAT yeniden kullanım politikası: ticari dahil serbest, kaynak belirtme |
| nat-lv | 🟢 | CSP politikası CC BY 4.0 (metaveri CC0; katı olan uygulanır) |
| nat-si | 🟢 | SURS telif sayfası: ticari dahil serbest, atıf |
| nat-hu | 🟢 | KSH CC BY 4.0 (özel talep çıkarımları hariç) |
| nat-pl | 🟢 | GUS BDL API CC BY 4.0 (GUS kendi sayfasında; TERYT yerine BDL kullanılıyor) |
| nat-ie | 🟢 | CC BY 4.0; veri ince (31 il/şehir, resmi kod yok) |
| nat-pt | 🟢 | DGT CAOP CC BY 4.0; freguesia kodu INE'ye ait |
| nat-cz | 🟢 | ČÚZK/ČSÚ CC BY 4.0 (atıf + metaveri + değişiklik belirtme) |
| **libaddressinput** | 🟢 | Veri CC BY 4.0 (hizmet sayfası + README okundu); posta kodu deseni/örnekleri ve adres düzeni; hizmet ToS okunamadı |
| **iana-tz** | 🟢 | tzdb kamu malı (LICENSE ve zone.tab başlığı okundu); ülke saat dilimleri (`zone.tab`, "deprecated" ama ülke başına tek satır) |
| **libphonenumber** | 🟢 | Apache-2.0 (dosya başlığı + LICENSE 4. madde okundu, NOTICE yok); yalnızca arama kodu/önekler; atıf metni lisans URL'si ve değişiklik notunu taşır |
| **wikidata** | 🟢 | Yapılandırılmış veri CC0 (ticari, yeniden dağıtım serbest, atıf gerekmez). Sınırlar: User-Agent zorunlu, 60 sn sorgu zaman aşımı, IP başına 5 paralel sorgu, 429 yönetimi; büyük çekimler için dump. Topluluk verisidir (resmi değil). Üçüncü taraf kökenli içerik CC0 ile temizlenmiş olmaz |
| ocha-cod-ab | 🟡 (ülkeye göre) | CC BY-IGO ticari kullanıma izin verir ama **TR 🔴** (metodoloji: "shared… for humanitarian use only"), PL 🟡 (UNHCR "from OSM PRG": ODbL olasılığı), BR 🟡 (IBGE kendi lisansı okunmadı) → **Türkiye için kullanılmaz** |
| cldr | 🟡 | Unicode License V3: ticari, satış, değiştirme serbest (bildirim korunur). Yerelleştirilmiş ülke adları ve `currencyData` 🟢; `territoryInfo` (nüfus/GSYH/dil) World Bank/CIA/Ethnologue kökenli tahmin 🟡; `territoryContainment` "UNM49 tabanlı" → BM M49 🔴 zincirine takılır |
| official-holidays | 🟡 | 8 ülkede (AT, CZ, DE, ES, HU, IT, PL, SE) mevzuat telif dışı/yeniden kullanım okundu; LV/HR işaretli; 12 ülke okunamadı |
| nat-ca | 🟢 | Statistics Canada Open Licence: kullanım, satış, katma değerli ürün, alt-lisans açıkça serbest; yalnızca atıf metni + onay izlenimi yasağı. Açık nokta: SGC sayfalarında lisans işareti yok ("most" veri ürünleri) |
| nat-jp | 🟢 | MIC: 公共データ利用規約 1.0 (CC BY 4.0 uyumlu), ticari kullanım açık; atıf + "değiştirildi" notu şart; xlsx dosya kimliği kararsız URL |
| nat-ch | 🟡 | opendata.swiss kaynaklarının hepsi `terms_open` (ticari serbest, kaynak önerilir); yeniden dağıtım/satış cümlesi yok, BFS kendi şart sayfası 404 |
| nat-kr | 🟡 / 🔴 | 행정동 verisi "제한 없음" (tanımsız); 법정동 연계 KOGL Tip 3 (türev yasak → türetilmiş API için 🔴); TLS hataları |
| nat-br | ⚪ | IBGE şartları 403 (Cloudflare); lisans metni okunamadı |
| **nat-in** | **🔴** | LGD Copyright Policy yalnızca "doğruysa serbest çoğaltma, kaynak belirt"; ticari/türev/satış yok; GODL PDF'leri erişilemedi |
| **nat-tr** | **🔴** | TÜİK Yasal Uyarı: "kaynak gösterilerek izne gerek olmaksızın yeniden kullanım mümkün" ama aynı sayfada "telif hakkı ve tüm haklar TÜİK'e aittir"; ticari kullanım/satış belirtilmemiş; İBBS'ye özgü koşul bulunamadı; NVİ/data.gov.tr/PTT ⚪ → **yazılı teyit olmadan alınmaz** |
