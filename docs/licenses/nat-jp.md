> **Ajan araştırması, 2026-10-04.** Bağımsız ikinci geçiş: 6 URL yeniden çekildi; özgün dildeki alıntı parçalarından 13 tanesi kaynakta bulundu, 8 tanesi bulunamadı. 

# Lisans dossier'i: nat-jp

> Hukuki görüş değildir. Yalnızca yayıncının sayfasından **okunan** metin alıntılanır; okunamayan alan "OKUNAMADI" yazılır, tahmin edilmez.

- **Okuma tarihi:** 2026-10-04
- **Yayıncı / veri seti:** 総務省 (MIC) — 全国地方公共団体コード: 「都道府県コード及び市区町村コード」 (xlsx/pdf) ve 「一部事務組合等コード」. Sayfa: https://www.soumu.go.jp/denshijiti/code.html
- **Kullandığımız alanlar / dosyalar:** https://www.soumu.go.jp/main_content/000925835.xlsx (sayfa: "（令和6年1月1日更新）"; sayfalar "R6.1.1現在の団体" ve "R6.1.1政令指定都市"; sütunlar: 団体コード, 都道府県名(漢字/カナ), 市区町村名(漢字/カナ)). Geometri yok, kişisel veri yok.

Kısaltmalar ve sha256 (ham gövde):
- CODE = https://www.soumu.go.jp/denshijiti/code.html — `040c86bfb4b497f2f8b9a6107c8fb7de3be554f38b7686a909d11b5629a9b331`
- XLSX = https://www.soumu.go.jp/main_content/000925835.xlsx — `7d04c8a7f6a6e76a7823a0414a8422bf2b26bb6070766971df76eab58ea6ff78`
- SITE = https://www.soumu.go.jp/menu_kyotsuu/policy/tyosaku.html (総務省「当ホームページについて」, 著作権について) — `630337f4dcc2cf6dc1e11f922884391d4c95dafb7a8301183882c2ec9a5961ef`
- PDL = https://www.digital.go.jp/resources/open_data/public_data_license_v1.0 (公共データ利用規約（第1.0版）, Digital Agency) — `98efa568c7ff146e5b884b904a09443be54e01fbfbca02cbf20e9d4c94a17bf2`
- ESTAT = https://www.e-stat.go.jp/terms-of-use (e-Stat 利用規約) — `b20b14e1740943d1269c3b09e230468ae738dfc058a311c44212eb6828fe799a`

Not: Görevlendirmede "政府標準利用規約（第2.0版）" öneriliydi. MIC sitesinin güncel sayfası bunun halefi olan **公共データ利用規約（第1.0版）** (PDL1.0, 2024-07-05) kuralını gösteriyor; e-Stat ise hâlâ 政府標準利用規約（第2.0版）'e uygun metin kullanıyor. İkisi de CC BY 4.0 uyumlu.

| # | Soru | Cevap | Kanıt (birebir alıntı) | URL | Sayfa sha256 |
|---|---|---|---|---|---|
| 1 | Lisans adı/sürümü ve lisans metni URL'si | MIC: 公共データ利用規約（第1.0版）(PDL1.0), CC BY 4.0 uyumlu. e-Stat: kendi利用ルール (政府標準利用規約 第2.0版'e uygun). | SITE: "権利表記の記載がない限り「公共データ利用規約（第1.0版）」に準拠した利用条件の下で利用することができます。" PDL: "本利用ルールは、クリエイティブ・コモンズ・ライセンスの表示4.0　国際ライセンス に規定される著作権利用許諾条件（以下「CC BY」といいます。）と互換性があります。" | SITE ; PDL | 630337f4…961ef ; 98efa568…7bf2 |
| 2 | Ticari kullanım serbest mi? | evet | PDL: "どなたでも以下の1.1.から1.7.に定める利用ルール（以下「本利用ルール」といいます。）に従って、複製、公衆送信、翻訳・変形等の翻案等、自由に利用できます（…）。商用利用も可能です。" ; ESTAT: "どなたでも以下の１）～６）に従って、複製、公衆送信、翻訳・変形等の翻案等、自由に利用できます。商用利用も可能です。" | PDL ; ESTAT | 98efa568…7bf2 ; b20b14e1…e799a |
| 3 | Ham veriyi yeniden dağıtma (dump satışı) | evet (複製・公衆送信; "satış" kelimesi geçmiyor, "商用利用も可能"; çıkarım) | PDL: "複製、公衆送信、翻訳・変形等の翻案等、自由に利用できます" ; "なお、数値データ、簡単な表・グラフ等は著作権による保護の対象ではありませんので、これらについては本利用ルールの適用はなく、自由に利用できます。" | PDL | 98efa568…7bf2 |
| 4 | Türetilmiş veritabanı / API satışı | evet (編集・加工等 serbest; işlendiğini belirtme şartı) | PDL: "本コンテンツを編集・加工等して利用する場合は、上記出典とは別に、編集・加工等を行ったこと及びその主体を記載してください。" SITE: "コンテンツを編集・加工等して利用する場合は、上記出典とは別に、編集・加工等を行ったことを記載してください。" | PDL ; SITE | 98efa568…7bf2 ; 630337f4…961ef |
| 5 | Müşteriye alt-lisans / müşteri yeniden dağıtabilir mi | Açık alt-lisans hükmü OKUNAMADI; ancak kural "どなたでも" (herkes) için geçerli ve CC BY ile uyumlu, yani alıcılar da doğrudan aynı kurala tabi. | PDL: "国…は、本利用ルールが適用される本コンテンツについて、利用者がCC BYに従って利用することを許諾します。" | PDL | 98efa568…7bf2 |
| 6 | Atıf metni ve biçimi | zorunlu | SITE: "出典：総務省ホームページ （当該ページのURL）" ; işlenmişse "「○○動向調査」（総務省） （当該ページのURL）を加工して作成" / "…をもとに○○株式会社作成" | SITE | 630337f4…961ef |
| 7 | Share-alike / viral şart | yok | PDL: kurallar 1.1-1.7 (atıf, üçüncü taraf, yasal kısıt, kapsam dışı, hukuk, sorumluluk); share-alike hükmü yok. | PDL | 98efa568…7bf2 |
| 8 | Non-commercial / izin gerektiren (ASK) şart | yok | "商用利用も可能です。" (PDL) | PDL | 98efa568…7bf2 |
| 9 | Üçüncü taraf IP istisnaları | var; MIC'in codes sayfasında ayrı hak belirtimi görülmedi | PDL: "本コンテンツの内、第三者が著作権を有しているものや、…については、特に権利処理済であることが明示されているものを除き、利用者の責任で、当該第三者から利用の許諾を得てください。" ; SITE 1.3: "一部のコンテンツには、個別法令により利用に制約がある場合があります。" | PDL ; SITE | 98efa568…7bf2 ; 630337f4…961ef |
| 10 | Marka/logo, onay izlenimi yasağı | var; sembol/logo kapsam dışı; işlenmiş veriyi devlet yayını gibi sunma yasağı | SITE: "編集・加工した情報を、あたかも国（又は府省等）が作成したかのような態様で公表・利用してはいけません。" ; 1.4 "組織や特定の事業を表すシンボルマーク、ロゴ、キャラクターデザイン" kuralın dışında | SITE | 630337f4…961ef |
| 11 | ToS: otomatik indirme / hız limiti / kimlik doğrulama | MIC için hüküm OKUNAMADI (SITE ve PDL'de bulunmadı). Dosya kimlik doğrulamasız HTTP 200 ile indirildi. e-Stat API ayrı menüde ("統計データの自動取得 / API"); API şartları okunmadı. | (hüküm bulunamadı) | SITE ; CODE | 630337f4…961ef ; 040c86bf…b331 |
| 12 | Veritabanı hakkı / ülke özgü kısıt | Japonya'da AB tipi sui generis hak yok (kaynakta söylenmiyor, çıkarım yapılmadı); PDL: uyuşmazlıkta Japon hukuku ve yetkili mahkeme. | PDL: "本利用ルールは、日本法に基づいて解釈されます。" | PDL | 98efa568…7bf2 |
| 13 | Kişisel veri | Yok: yalnız kod ve idari birim adları (xlsx içeriği okundu). | XLSX sütunları: 団体コード, 都道府県名, 市区町村名 (漢字/カナ) | XLSX | 7d04c8a7…ff78 |
| 14 | Garanti reddi / sorumluluk | var | PDL: "国…は、利用者が本コンテンツを用いて行う一切の行為（本コンテンツを編集・加工等した情報を利用することを含みます。）について何ら責任を負うものではありません。" SITE: "総務省は利用者が当ホームページの情報を用いて行う一切の行為について、何ら責任を負うものではありません。" | PDL ; SITE | 98efa568…7bf2 ; 630337f4…961ef |
| 15 | Şart değişikliği hakkı / sürüm | Değişebilir; önceki sürümle başlayanlar eski şarta tabi. | PDL: "本利用ルールは、今後変更される可能性があります。なお、既に以前の政府標準利用規約にしたがってコンテンツを利用している場合は、引き続きその条件が適用されます。" SITE: "当ホームページは、予告なしに内容を変更又は削除する場合があります" | PDL ; SITE | 98efa568…7bf2 ; 630337f4…961ef |
| 16 | Yaptırım/ihracat kısıtı | OKUNAMADI (metinlerde yok) | — | PDL | 98efa568…7bf2 |

e-Stat (kullanmıyoruz ama istenmişti): ESTAT'ta ticari kullanım ve atıf PDL ile aynı; atıf örneği "出典：政府統計の総合窓口(e-Stat)（https://www.e-stat.go.jp/）"; "コンテンツは、予告なく変更、移転、削除等が行われることがあります。"; "外部データベース等とのＡＰＩ…連携等により取得しているコンテンツについては、その提供元の利用条件に従ってください。"; "本利用ルールは、平成２８年１月２９日に定めたものです。本利用ルールは、政府標準利用規約（第2.0版）に準拠しています。"

## Güncelleme (refresh) bilgisi
- **Yayın sıklığı** (kaynağın kendi beyanı): "以来、変更が生じた都度、更新を行っています。" (CODE; düzenli takvim yok, değişiklik oldukça). Sayfada: 都道府県コード及び市区町村コード "（令和6年1月1日更新）"; 改正一覧表 "（令和5年4月1日更新）"; 一部事務組合等コード "（令和8年4月1日更新）" (yıllık, "毎年4月1日現在"). **Sürüm/vintage adlandırması:** sayfa adı sheet "R6.1.1現在" (Reiwa 6 = 2024-01-01); dosya adında sürüm yok. **Değişim bildirimi:** RSS/API bulunamadı (OKUNAMADI); yalnız sayfadaki güncelleme tarihi ve "改正一覧表" (2005-04-01 sonrası değişiklik listesi). **Kararlı URL mi:** Hayır (çıkarım): dosyalar sayısal ID ile (000925835.xlsx, 000925834.pdf, 000875487.pdf...) ve her güncellemede yeni ID verilmesi muhtemel; kararlı giriş noktası CODE sayfası, ID'yi sayfadan çözün.
- **Teknik not:** xlsx, 2 sayfa (団体 listesi ve 政令指定都市), 5967 paylaşılan metin; kodlar 6 haneli (5 hane + kontrol hanesi; "全国地方公共団体コード」仕様" PDF'i ayrı; okunmadı). Kanji + yarım genişlikli katakana okunuşları. Sunucu sayfaları Shift_JIS/CP932 olabilir (CODE sayfası UTF-8 dışı çözüldü). Bulunmayan: İngilizce adlar.

## Karar
- **🟢 satışa uygun** — gerekçe: MIC sitesi içeriği PDL1.0 (CC BY 4.0 uyumlu) altında yayımlıyor; metin "自由に利用できます…商用利用も可能です", işleme serbest, share-alike yok. Tek şartlar: atıf (+ işlenmişse bunu belirtme), devlet yayını gibi sunmama, üçüncü taraf/logo istisnaları.
- Açık sorular / yayıncıya yazılacak teyit: (1) "satış"/alt-lisans kelimeleri metinde yok; "商用利用も可能" ve CC BY uyumundan çıkarım. (2) CODE sayfasında ayrı hak belirtimi görmedik; SITE metni "権利表記の記載がない限り" diyor. (3) Otomatik indirme/API şartı yok/okunamadı. (4) Dosya R6.1.1 (2024) tarihli; sonraki belediye birleşmeleri için gerçek güncelliği yayıncıya sorun. (5) /menu_kyotsuu/policy/ dizin sayfası HTTP 403 verdi (okunamadı), tyosaku.html okundu.
- Okuyan: Claude (otomatik araştırma) Bağımsız ikinci geçiş yapıldı mı: hayır (2026-10-04)
