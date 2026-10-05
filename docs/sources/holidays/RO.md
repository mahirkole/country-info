# RO – Romanya resmi tatiller (taslak)

**Okunan kaynak.** Legea nr. 53/2003 – Codul muncii (republicat, M.Of. nr. 345/18.05.2011), **forma consolidata la 21.03.2023** ("valabila de la 9 martie 2023 pana la 22 martie 2023"; CTCE konsolidasyon notu). Resmi kurum (Inspecția Muncii) üzerinden barındırılan PDF:
https://www.inspectiamuncii.ro/documents/558066/58123041/codul+muncii+din+24+ianuarie+2003.pdf/74898488-ba66-483c-a185-1eab00d43892?version=1.0
(yerel kopya: /tmp/holidays_draft/raw_bgrocy/ro_cm.txt, satır 2200 ve sonrası). legislatie.just.ro proxy politikasıyla engelli (connect reddi), cdep.ro/mmuncii.gov.ro bağlanılamadı.

**ÖNEMLİ UYARI.** Okunan metin 2023-03-21 konsolidasyonu; sonraki değişiklikler kontrol edilmedi (SE'deki emsal gibi `verified` verildi ama güncellik doğrulanmadı). Güncel sürüm legislatie.just.ro'dan teyit edilmeli.

**Alıntı (art. 139 alin. (1), orijinal – diakritiksiz):**
> "(1) Zilele de sarbatoare legala in care nu se lucreaza sunt: - 1 si 2 ianuarie; - 6 ianuarie - Botezul Domnului - Boboteaza; - 7 ianuarie - Soborul Sfantului Proroc Ioan Botezatorul; - 24 ianuarie - Ziua Unirii Principatelor Romane; - Vinerea Mare, ultima zi de vineri inaintea Pastelui; - prima si a doua zi de Pasti; - 1 mai; - 1 iunie; - prima si a doua zi de Rusalii; - Adormirea Maicii Domnului; - 30 noiembrie - Sfantul Apostol Andrei, cel Intai chemat, Ocrotitorul Romaniei; - 1 decembrie; - prima si a doua zi de Craciun; - doua zile pentru fiecare dintre cele 3 sarbatori religioase anuale, declarate astfel de cultele religioase legale, altele decat cele crestine, pentru persoanele apartinand acestora."

**Kurallar.**
- `verified` (12): new-year (1 Oca), new-year-2 (2 Oca), epiphany (6 Oca), st-john (7 Oca), union-day (24 Oca), good-friday (Pastenin son Cuması = Easter-2), easter-sunday, easter-monday, labour-day, childrens-day (1 Haz), st-andrew (30 Kas), national-day (1 Ara). Tarihler metinde yazıyor; Paskalya Ortodoks takvimiyle hesaplanıyor (metin takvimi söylemiyor – alin. (2^1)'e göre Hristiyan cemaatler kendi tarihini kullanır).
- `unverified` (5), `checked_on` yok: whit-sunday (+49) / whit-monday (+50) – metin yalnızca "prima/a doua zi de Rusalii" der, ofset metinde yok; dormition (15 Ağu), christmas (25 Ara), christmas-2 (26 Ara) – metin takvim tarihini vermiyor, tarih hafızadan.
- `from_year: 2023` (epiphany, st-john, union-day, good-friday, childrens-day): konsolide notlar bu maddelerin 2016–2023 arası eklemelerle geldiğini gösteriyor (Legea 220/2016, 64/2018, 52/2023) ama hangi notun hangi satıra ait olduğu PDF çıktısında net değil; tarih öncesi geçerlilik **belirlenmedi**, güvenli alt sınır olarak 2023 kullanıldı. Diğer kuralların 2023 öncesi geçmişi (örn. 30 Kasım, 2012 öncesi) incelenmedi.

**Modellenemeyenler.**
- alin. (2^1)/(3^1): Katolik/Protestan vb. çalışanlar kendi Paskalya/Rusalii tarihini kullanabilir (Gregoryen) – modellenmedi.
- alin. (1) son madde: gayrimüslim dinler için kişi başına 2 gün x 3 – kişisel, modellenmedi.
- alin. (4): Hükümet her yıl 15 Ocak'a kadar bütçe sektörü için köprü günlerini HG ile belirler – yıllık, okunmadı.
- Hafta sonuna denk gelen tatil için telafi günü (Legea 52/2023 öncesi/sonrası tartışmalı) – bu konsolide metinde alin. (2)'de yalnızca "acordarea zilelor libere se face de catre angajator" var; ek telafi kuralı eklenmedi.
