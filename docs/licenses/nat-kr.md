> **Ajan araştırması, 2026-10-04.** Bağımsız ikinci geçiş: 10 URL yeniden çekildi; özgün dildeki alıntı parçalarından 9 tanesi kaynakta bulundu, 11 tanesi bulunamadı. 4 URL çekilemedi (TLS/erişim)

# Lisans dossier'i: nat-kr

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-04
- **Yayıncı / veri seti:** 국가데이터처 (eski 통계청 / KOSTAT) — 한국행정구역분류 (KSSC) verileri, Kamu Veri Portalı (data.go.kr) üzerinden. İki ayrı dosya veri seti okundu ve **lisansları farklı**:
  - (A) "국가데이터처_행정동 정보_20250704": https://www.data.go.kr/data/15136373/fileData.do
  - (B) "국가데이터처_법정동 연계정보_20250602": https://www.data.go.kr/data/15136368/fileData.do
  Birincil kaynak siteleri kssc.kostat.go.kr (TLS sertifika adı uyuşmuyor) ve code.go.kr (lisans metni yok) okunamadı; aşağıya bakın.
- **Kullandığımız alanlar / dosyalar:** (planlanan) il/ilçe/eup-myeon-dong kodları ve adları, kademe ilişkisi (행정동 kodu, 행정동명, 법정동). CSV. Geometri ve kişisel veri yok.

Kısaltmalar ve sha256 (ham gövde):
- DS_A = https://www.data.go.kr/data/15136373/fileData.do — `1c16445c8158dbce1dd2cd1688616a2a0fb813335baac057324a83bfc2295660`
- DS_B = https://www.data.go.kr/data/15136368/fileData.do — `f02641f9756e9f03f896d90aa0f16f2db479493e71a14ed46d77c89283d290c4`
- POL = https://www.data.go.kr/ugs/selectPortalPolicyView.do (공공데이터포털 정책: 이용허락범위 + 이용약관) — `6825296a0bb991db7ec09bb3b26143a1793979dc965b466c4188aac6490afe95`
- K1 = https://www.kogl.or.kr/info/licenseType1.do — `6b40c3874cf8866f61d8d1bab95e5d4bbedae4dd11347288883a1e83cfd425a6`
- K3 = https://www.kogl.or.kr/info/licenseType3.do — `554757d9d674acdd06dbf9c100f4cc7bfddae04a5c3b8cf7e3dfa47f3d6664f1`
- CODE = https://www.code.go.kr/stdcode/regCodeL.do — `abf18e448b11e483a7596084f4893670ada47456f25775e00664515362c0c118`

Önemli bulgu: Görevlendirmede varsayılan "KOGL Type 1" iki veri setinde de **doğrulanmadı**. (A) için portal "이용허락범위 제한 없음" gösteriyor (KOGL türü belirtilmiyor); (B) için KOGL **Tür 3 (출처표시, 변경금지)** gösteriyor. Lisans işareti (görsel rozet) metin olarak okunduğu için birebir alıntı sayfanın alanıdır.

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL | Sayfa sha256 |
|---|---|---|---|---|---|
| 1 | Lisans adı/sürümü ve lisans metni URL'si | (A) "이용허락범위 제한 없음" (KOGL türü yok; ifadenin tanımı okunan sayfalarda yok). (B) KOGL Tür 3. Lisans metni: https://www.kogl.or.kr/info/licenseType3.do | (A) "이용허락범위" / "이용허락범위 제한 없음" ; (B) "이용허락범위" / "공공저작물 : 출처표시, 변경금지 (제 3유형)" | DS_A ; DS_B | 1c16445c…5660 ; f02641f9…290c4 |
| 2 | Ticari kullanım serbest mi? | (A) şartlı/belirsiz: "비용부과유무: 무료"; "제한 없음" ticari kullanımı açıkça anmıyor. (B) evet (KOGL 3 ticari kullanıma izin verir) | (A) "비용부과유무" "무료" ; POL: "[제0유형] 자유이용 … 상업적, 비상업적 이용가능" ; K3: "이 저작물은 영리 목적으로 이용할 수 있습니다" | DS_A ; POL ; K3 | 1c16445c…5660 ; 6825296a…fe95 ; 554757d9…664f1 |
| 3 | Ham veriyi yeniden dağıtma (dump satışı) | (B) KOGL 3: "온·오프라인 상에 공유 및 이용" mümkün, değişiklik yok → aynen yeniden dağıtım izinli. (A) OKUNAMADI (açık hüküm yok) | K3: "온·오프라인 상에 공유 및 이용 : 온·오프라인을 통하여 공유 및 이용 가능" | K3 | 554757d9…664f1 |
| 4 | Türetilmiş veritabanı / API satışı | (B) **hayır**: değişiklik/2차적 저작물 yasak. (A) OKUNAMADI ("제한 없음" yorumu belirsiz) | K3: "변경금지 : 저작물을 변경하거나 2차적 저작물 등으로 작성할 수 없습니다." ; POL: "[제3유형] 출처표시+변경금지 … 변형 등 2차적 저작물 작성 금지" | K3 ; POL | 554757d9…664f1 ; 6825296a…fe95 |
| 5 | Müşteriye alt-lisans / müşteri yeniden dağıtabilir mi | OKUNAMADI (KOGL özetinde alt-lisans hükmü yok; tam 공공누리 이용약관 okunmadı) | — | K3 | 554757d9…664f1 |
| 6 | Atıf metni ve biçimi | zorunlu (KOGL); sayfada biçim şablonu yok | K1/K3: "출처 표시 : 저작물의 출처를 표시하셔야 합니다." | K3 | 554757d9…664f1 |
| 7 | Share-alike / viral şart | yok (KOGL 1/3 özetinde) | (hüküm bulunamadı) | K1 | 6b40c387…25a6 |
| 8 | Non-commercial / izin gerektiren (ASK) şart | (B) yok (Tür 3 ticari kullanıma açık; Tür 2/4 olsaydı yasaktı). (A) "제한 없음" | POL: "[제2유형] 출처표시+상업적 이용금지 … 비상업적만 이용가능" (bizim setlerde uygulanmıyor) | POL | 6825296a…fe95 |
| 9 | Üçüncü taraf IP istisnaları | portal genel uyarı | POL: "저작권 등 제3자 권리가 포함된 공공데이터는 권리자의 정당한 이용허락을 확보해야 합니다." | POL | 6825296a…fe95 |
| 10 | Marka/logo, onay izlenimi yasağı | var | K3: "※ 공공기관이 후원한다거나 공공기관과 특수한 관계에 있는 것처럼 제 3자가 오인하게 하는 표시를 해서는 안됩니다." | K3 | 554757d9…664f1 |
| 11 | ToS: otomatik indirme / hız limiti / kimlik doğrulama | Dosya verisi girişsiz indirilebilir; (otomasyon/oran limiti hükmü OKUNAMADI). OpenAPI ayrı anahtar gerektirir (okunmadı). | DS_A/DS_B: "파일데이터는 로그인 없이 다운로드를 통해 이용하실 수 있습니다." | DS_A | 1c16445c…5660 |
| 12 | Veritabanı hakkı / ülke özgü kısıt | OKUNAMADI (공공데이터법 atıfları var ama madde metni okunmadı) | POL: "공공데이터법 제17조 상의 제외대상 정보가 포함된 경우 제공이 거부될 수 있으며" | POL | 6825296a…fe95 |
| 13 | Kişisel veri | Kod ve idari birim adları; kişisel veri yok. (B) satırları 1.048.576 = Excel satır sınırı: dosya kesilmiş olabilir (aşağıda). | DS_B: "전체 행" "1048576" ; DS_A: "전체 행" "569727" ; DS_A: "데이터값이 공란인 부분은 미집계 데이터로 공란처리되었으니 양해해주시기 바랍니다." | DS_A ; DS_B | 1c16445c…5660 ; f02641f9…290c4 |
| 14 | Garanti reddi / sorumluluk | OKUNAMADI (veri seti sayfalarında/KOGL özetinde yok; portal 이용약관 tam metni okunmadı) | — | POL | 6825296a…fe95 |
| 15 | Şart değişikliği hakkı / sürüm | KOGL: koşullar değişebilir, önceki kullanım korunur. Portal 이용약관 2023-06-08 yürürlükte. | K1: "공공누리 저작물의 이용조건은 변경될 수 있습니다. 다만 이용자가 이용조건 변경전 사용하셨다면 해당저작물 한해 용도변경 없이 계속 이용할 수 있습니다." ; POL: "본 약관은 2023년 6월 8일부터 시행됩니다." | K1 ; POL | 6b40c387…25a6 ; 6825296a…fe95 |
| 16 | Yaptırım/ihracat kısıtı | OKUNAMADI | — | — | — |

Birincil kaynaklar:
- https://kssc.kostat.go.kr/ : OKUNAMADI. https (2 deneme): curl (60) "SSL: no alternative certificate subject name matches target host name 'kssc.kostat.go.kr'" (TLS doğrulaması kapatılmadı); /ksscNew_web/... ve :8443: bağlantı sıfırlandı; http:// 200 ama yalnızca 505 baytlık yönlendirme kabuğu ("통계분류포털").
- https://www.code.go.kr/ : ana sayfa 1. denemede bağlantı sıfırlandı, 2.de 200 ama boş ("Wait.."). /stdcode/regCodeL.do (법정동코드목록조회) okundu: lisans/저작권 metni YOK; /etc/copyright.do ve /etc/useInfo.do: 404 ("잘못된 접근입니다"). Dolayısıyla code.go.kr için lisans OKUNAMADI.
- https://www.kostat.go.kr/ (국가데이터처): 2. denemede 200, lisans araması yapılmadı.

## Güncelleme (refresh) bilgisi
- **Yayın sıklığı** (kaynağın kendi beyanı): "업데이트 주기: 연간" (DS_A ve DS_B). "차기 등록 예정일: 2026-08-06" — okuma tarihi 2026-10-04'te bu tarih geçmiş ve "수정일" hâlâ 2025-07-07: yayın gecikmiş veya sayfa güncellenmemiş olabilir. **Sürüm/vintage adlandırması:** dosya adı tarih eki taşır (_20250704, _20250602); "등록일 2024-09-11, 수정일 2025-07-07". **Değişim bildirimi:** RSS/API bulunamadı (OKUNAMADI); portalda OpenAPI sekmesi var, okunmadı. **Kararlı URL mi:** Veri seti ID'leri (15136373, 15136368) kararlı; indirme bağlantısı "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003181687&fileDetailSn=1&insertDataPrcus=N" (A için) dosya sürümüyle değişebilir.
- **Teknik not:** CSV (A: 569.727 satır, B: 1.048.576 satır = Excel üst sınırı, kesinti olasılığı). Alan listesi "행정구역분류,행정동코드,행정동명,법정동,분류체계". İndirme girişsiz; dosyalar fiilen indirilmedi (içerik/kodlama doğrulanmadı, genellikle CP949 olabilir: doğrulanmadı). "통계청 한국 행정 구역 분류는 통계작성을 목적으로 전국의 행정 구역을 일정한 순서에 따라 부호화한 자료입니다."

## Karar
- **🟡 şartlı** — gerekçe: (A) 행정동 정보 için portal "이용허락범위 제한 없음" diyor ve ücretsiz; fakat bu ifade KOGL türü değil ve ticari/türetme/yeniden dağıtım okunan sayfada açıkça tanımlanmamış (portal tablosundaki "제0유형 자유이용" ile aynı olduğu SÖYLENMİYOR). (B) 법정동 연계정보 KOGL Tür 3: ticari kullanım ve aynen dağıtım serbest, ama **değişiklik/türetilmiş veritabanı yasak**; bu nedenle dönüştürülmüş API/DB için uygun değil (🔴). 
- Açık sorular / yayıncıya yazılacak teyit: (1) "이용허락범위 제한 없음" hangi KOGL türüne denk (0. tür?) ve ticari/2차 türetme serbest mi: data.go.kr veya 국가데이터처 통계기준과'ya yazılı teyit. (2) kssc.kostat.go.kr'in birincil sayfasındaki lisans/저작권 notu (TLS hatası nedeniyle okunamadı; başka ağdan denenmeli). (3) code.go.kr 법정동코드 (행정안전부) lisansı bulunamadı. (4) Yıllık güncelleme gecikmesi (2026-08-06 geçti).
- Okuyan: Claude (otomatik araştırma) Bağımsız ikinci geçiş yapıldı mı: hayır (2026-10-04)
