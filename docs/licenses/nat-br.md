> **Ajan araştırması, 2026-10-04.** Bağımsız ikinci geçiş: 8 URL yeniden çekildi; özgün dildeki alıntı parçalarından 2 tanesi kaynakta bulundu, 2 tanesi bulunamadı. IBGE şartları Cloudflare engelli, neredeyse hiçbir satır okunamadı

# Lisans dossier'i: nat-br

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-04
- **Yayıncı / veri seti:** IBGE (Instituto Brasileiro de Geografia e Estatística) — "API de localidades" (servicodados.ibge.gov.br/api/v1/localidades: estados, municipios, ...).
- **Kullandığımız alanlar / dosyalar:** (planlanan) estados (27 kayıt: id, sigla, nome, região) ve municipios (5571 kayıt: id (7 haneli IBGE kodu), nome, microrregião, mesorregião, UF, região imediata/intermediária) JSON. Geometri ve kişisel veri yok.

Kısaltmalar ve sha256 (ham gövde):
- EST = https://servicodados.ibge.gov.br/api/v1/localidades/estados — `7ca1368dea3af83cba1af84ae8a7e88f1173c97586831d086cc8b3c1ba9c6596`
- MUN = https://servicodados.ibge.gov.br/api/v1/localidades/municipios — `86ecdccdf97d72e7e5e46f0854cfcea8bacc28154cc1bc4ed0e6110e3a6c9c02`
- DOCS = https://servicodados.ibge.gov.br/api/docs/localidades — `b679b089b03415bbf036519374b5a4f9715a7bbf90fca8edff7c80b5f4cba6b8`
- HOME = https://www.ibge.gov.br/ — `e36a2f3e7e84fa9cbd4a7f19bd31282cbeebbf29a295f612d2fdc9af685a419e`
- FTP = https://ftp.ibge.gov.br/ — `6df7bf66841ed417e766960003b962f0c3d1406a952e2c72a94106407e74fff9`
- Cloudflare engel sayfaları (HTTP 403, içerik yok): https://www.ibge.gov.br/termosdeuso.html `a3a33a3c852d665e66df48d8b5c2dcea4b0ed897ebe40100c7c084a1dda9fc39` ; https://www.ibge.gov.br/en/terms-of-use.html `bfe9f4281401b9bb6e7a1fa0d0d38d2fdc89901520060ead4f56fef89a7b44c0` ; https://www.ibge.gov.br/acesso-informacao/institucional/politica-de-uso.html `5a89f99f43538d4f9acb778dd3cafae09263840e0df4f095a509edf122c09790` (gövde: "Just a moment... Enable JavaScript and cookies to continue").

Erişim özeti: API uç noktaları HTTP 200 (kimlik doğrulamasız). www.ibge.gov.br ana sayfa 200 okundu ama koşul sayfası linki yok; /termosdeuso.html, /en/terms-of-use.html, /acesso-informacao/institucional/politica-de-uso.html, /acesso-informacao/dados-abertos.html, /acesso-informacao/institucional/termo-de-uso.html, /politica-de-privacidade.html, biblioteca.ibge.gov.br, sidra.ibge.gov.br: HTTP 403 (Cloudflare JS challenge) — 1 deneme + alternatif adreslerle OKUNAMADI. dadosabertos.ibge.gov.br: proxy 502. dados.gov.br: JavaScript gerektiriyor (içerik yok). web.archive.org: bağlantı sıfırlandı; archive.org Wayback API "archived_snapshots": {} döndü.

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL | Sayfa sha256 |
|---|---|---|---|---|---|
| 1 | Lisans adı/sürümü ve lisans metni URL'si | OKUNAMADI (IBGE koşul sayfaları engelli; API dokümanında lisans cümlesi yok: "licen", "termo", "uso" aramaları sonuçsuz) | — | DOCS | b679b089…cba6b8 |
| 2 | Ticari kullanım serbest mi? | OKUNAMADI | — | — | — |
| 3 | Ham veriyi yeniden dağıtma (dump satışı) | OKUNAMADI. Yalnızca FTP sayfasında genel ifade: | "Todos os arquivos aqui disponíveis são públicos." (ftp.ibge.gov.br; "público" = erişilebilir, yeniden kullanım koşulu anlamına geldiği söylenmiyor) | FTP | 6df7bf66…74fff9 |
| 4 | Türetilmiş veritabanı / API satışı | OKUNAMADI | — | — | — |
| 5 | Müşteriye alt-lisans / yeniden dağıtım | OKUNAMADI | — | — | — |
| 6 | Atıf metni ve biçimi | OKUNAMADI | — | — | — |
| 7 | Share-alike / viral şart | OKUNAMADI | — | — | — |
| 8 | Non-commercial / izin gerektiren (ASK) şart | OKUNAMADI | — | — | — |
| 9 | Üçüncü taraf IP istisnaları | OKUNAMADI | — | — | — |
| 10 | Marka/logo, onay izlenimi yasağı | OKUNAMADI | — | — | — |
| 11 | ToS: otomatik indirme / hız limiti / kimlik doğrulama | Kimlik doğrulama yok (HTTP 200, anahtarsız); CORS açık; hız limiti hükmü OKUNAMADI. Yanıt başlıkları: "Cache-Control: max-age=2592000" (30 gün), "Access-Control-Allow-Origin: *". Not: /api/docs/agregados bir kez HTTP 500 verdi. | HTTP başlığı: "Access-Control-Allow-Methods: GET, POST, OPTIONS" | MUN | 86ecdccd…a6c9c02 |
| 12 | Veritabanı hakkı / ülke özgü kısıt | OKUNAMADI | — | — | — |
| 13 | Kişisel veri | Yok: idari birim kodu ve adı (JSON yapısı okundu). | `{"id":1100015,"nome":"Alta Floresta D'Oeste","microrregiao":{...}}` | MUN | 86ecdccd…a6c9c02 |
| 14 | Garanti reddi / sorumluluk | OKUNAMADI | — | — | — |
| 15 | Şart değişikliği hakkı / sürüm | OKUNAMADI | — | — | — |
| 16 | Yaptırım/ihracat kısıtı | OKUNAMADI | — | — | — |

Not: Brezilya Erişim-Bilgi Yasası (Lei 12.527/2011) ve açık veri kararnamesi gibi dış hukuk metinleri okunmadı; bunlardan çıkarım yapılmadı.

## Güncelleme (refresh) bilgisi
- **Yayın sıklığı** (kaynağın kendi beyanı): OKUNAMADI (API dokümanı ve ana sayfada beyan bulunamadı). **Sürüm/vintage adlandırması:** API yolu "v1"; belediye listesi tarihsel sürüm parametresi yok (okunan dokümanda belirtilmedi). **Değişim bildirimi:** OKUNAMADI. **Kararlı URL mi:** API yolları sürümlü (/api/v1/...), 30 günlük önbellek başlığı mevcut; kararlılık beyanı yok.
- **Teknik not:** JSON, UTF-8. /estados = 27 kayıt; /municipios = 5571 kayıt, iç içe (microrregiao>mesorregiao>UF>regiao ve "regiao-imediata"). İnteraktif dokümantasyon: https://servicodados.ibge.gov.br/api/docs/localidades (Swagger benzeri, endpoint listesi: AglomeracaoUrbana, Distritos, ...).

## Karar
- **⚪ okunamadı** — gerekçe: IBGE'nin kullanım koşulları/açık veri politikası sayfaları Cloudflare engeli nedeniyle okunamadı; API dokümantasyonunda lisans ifadesi yok. Ticari kullanım ve satış için dayanak metin yok; bu haliyle yüklenmemeli (CLAUDE.md: `licenseStatus: 'unread'`).
- Açık sorular / yayıncıya yazılacak teyit: IBGE "Termos de uso / Política de uso de dados" sayfasının insan tarayıcıyla okunması (https://www.ibge.gov.br/termosdeuso.html), servicodados API için ayrı koşul olup olmadığı, atıf biçimi, ticari yeniden dağıtım ve API satışı.
- Okuyan: Claude (otomatik araştırma) Bağımsız ikinci geçiş yapıldı mı: hayır (2026-10-04)
