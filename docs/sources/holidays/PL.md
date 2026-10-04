> **Not:** Bu dosya bir ajanın okuma notudur (2026-10-04). Depodaki `data/holidays/PL.json` esas alınır; orada `verification` durumu bu notlardan farklı olabilir (güncel olmayan metin sürümü veya hafızadan gelen tanım tespit edilenler `unverified`'a indirildi).

# PL evidence
isap.sejm.gov.pl returned 403. Used official Sejm ELI API (api.sejm.gov.pl), HTTP 200.
Consolidated text (Obwieszczenie Marszałka Sejmu z 6.03.2025, Dz. U. 2025 poz. 296): https://api.sejm.gov.pl/eli/acts/DU/2025/296/text/T/D20250296L.pdf

Verbatim art. 1: "Dniami wolnymi od pracy są: 1) dni niżej wymienione: a) 1 stycznia – Nowy Rok, b) 6 stycznia – Święto Trzech Króli, c) pierwszy dzień Wielkiej Nocy, d) drugi dzień Wielkiej Nocy, e) 1 maja – Święto Państwowe, f) 3 maja – Święto Narodowe Trzeciego Maja, g) pierwszy dzień Zielonych Świątek, h) dzień Bożego Ciała,"
Continuation: "i) 15 sierpnia – Wniebowzięcie Najświętszej Maryi Panny, j) 1 listopada – Wszystkich Świętych, k) 11 listopada – Narodowe Święto Niepodległości, ka) 24 grudnia – Wigilia Bożego Narodzenia, l) 25 grudnia – pierwszy dzień Bożego Narodzenia, m) 26 grudnia – drugi dzień Bożego Narodzenia; 2) niedziele."
All rules except epiphany and christmas-eve cite this URL (same text also in https://api.sejm.gov.pl/eli/acts/DU/1951/28/text/U/D19510028Lj.pdf).

- epiphany (from_year 2011): Ustawa z 24.09.2010, Dz. U. Nr 224 poz. 1459, https://api.sejm.gov.pl/eli/acts/DU/2010/1459/text.html : "Art. 2. W ustawie z dnia 18 stycznia 1951 r. o dniach wolnych od pracy ... w art. 1 w pkt 1 lit. b otrzymuje brzmienie: „b) 6 stycznia - Święto Trzech Króli,”" ; "Art. 4. Ustawa wchodzi w życie z dniem 1 stycznia 2011 r."
- christmas-eve (from_year 2025): Ustawa z 6.12.2024, Dz. U. poz. 1965, https://api.sejm.gov.pl/eli/acts/DU/2024/1965/text.html : "w art. 1 w pkt 1 po lit. k dodaje się lit. ka w brzmieniu: „ka) 24 grudnia - Wigilia Bożego Narodzenia,”"; entry into force "z dniem 1 lutego 2025 r." (Art. 5, quoted in Dz. U. 2025 poz. 296 obwieszczenie).

## Not included
- Sundays (art. 1 pkt 2 "niedziele"); Easter Sunday and Pentecost Sunday are included as listed in the act (they fall on Sundays); no Whit Monday.
- Art. 1a epidemic-day decrees (by regulation of the Prime Minister).
- Saturday holiday-offset rules (Kodeks pracy art. 130 §2) not modelled.

## Could not read
- isap.sejm.gov.pl (403); the ISAP is replaced by api.sejm.gov.pl which is the same official publisher.
