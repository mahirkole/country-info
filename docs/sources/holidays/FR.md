# FR – okuma notları (2026-10-05)

Légifrance (legifrance.gouv.fr) 403 verdi. Okunan resmi kaynaklar: Code du travail numérique (code.travail.gouv.fr, Çalışma Bakanlığı) ve service-public.fr (DILA, Başbakanlık).

## Okunan metinler
- https://code.travail.gouv.fr/code-du-travail/l3133-1 ("Mis à jour le : 10/08/2016"):
  « Les fêtes légales ci-après désignées sont des jours fériés : 1° Le 1er janvier ; 2° Le lundi de Pâques ; 3° Le 1er mai ; 4° Le 8 mai ; 5° L'Ascension ; 6° Le lundi de Pentecôte ; 7° Le 14 juillet ; 8° L'Assomption ; 9° La Toussaint ; 10° Le 11 novembre ; 11° Le jour de Noël. »
- https://code.travail.gouv.fr/code-du-travail/l3134-13 ("Mis à jour le : 01/05/2008"):
  « Les jours fériés ci-après désignés sont des jours chômés : 1° Le 1er Janvier ; 2° Le Vendredi Saint dans les communes ayant un temple protestant ou une église mixte ; 3° Le lundi de Pâques ; 4° Le 1er Mai ; 5° Le 8 Mai ; 6° L'Ascension ; 7° Le lundi de Pentecôte ; 8° Le 14 Juillet ; 9° L'Assomption ; 10° La Toussaint ; 11° Le 11 Novembre ; 12° Le premier et le second jour de Noël. Un décret peut compléter la liste de ces jours fériés compte tenu des situations locales et confessionnelles. »
- https://code.travail.gouv.fr/code-du-travail/l3134-14: Moselle'de Vendredi Saint'te ticari işletmelerin açılışını idari makam tüm departmanda tek tip belirleyebilir (komün şartından bağımsız).
- https://www.service-public.fr/particuliers/vosdroits/F2405 ("Vérifié le 01 janvier 2026"): 2026 tabloları; Alsace-Moselle: « Vendredi Saint (dans les communes ayant un temple protestant ou une église mixte) Vendredi 3 avril 2026 », « 2 e jour de Noël Samedi 26 décembre 2026 ». Tüm tarihler motor çıktısıyla uyumlu (Paskalya Pzt 6 Nisan, Ascension 14 Mayıs, Pentecôte Pzt 25 Mayıs 2026).

## Kurallar
- 11 ulusal kural (L3133-1 1°–11°): `verified`. Paskalya ofsetleri (+1, +39, +50) metinde sayı olarak yazmıyor, isimden türetildi; service-public 2026 tablosuyla çapraz doğrulandı.
- Alsace-Moselle: `region` tek değer olduğundan departman başına 2 kural: `div:FR:dep-57` (Moselle), `dep-67` (Bas-Rhin), `dep-68` (Haut-Rhin) – id'ler `src/sources/national/fr.ts` kalıbı (`div:FR:dep-<DEP>`). `verified` (L3134-13 metni okundu).
  - "26 Aralık": metin "le second jour de Noël" diyor; 26 Aralık çıkarımı service-public 2026 tablosuyla (Cumartesi 26 Aralık) doğrulandı.
  - Vendredi Saint **yalnızca temple protestant / église mixte olan komünlerde**; motor komün düzeyini modellemiyor, kural departman geneline düşer (aşırı kapsama) – citation'da belirtildi. Lead'in "L3134-13: Good Friday ve 26 Aralık" ifadesi birebir değil: 26 Aralık metinde sayı değil "ikinci Noël günü".

## Okunmayan / modellenmeyen
- Légifrance resmi konsolide sürümü (403); L3133-1 yalnızca Code du travail numérique kopyasından okundu (verified sayıldı; istenirse `unverified`'a çekilebilir).
- Denizaşırı (DROM, Saint-Barthélemy, Saint-Martin) kölelik karşıtı anma günleri (service-public'te var, tarihleri departmana göre değişir) okunmadı/modellenmedi.
- Kamu görevlileri / "journée de solidarité" (Pentecôte Pazartesi çalışma günü yapılabilir) konusu kapsam dışı; L3133-1 yalnızca yasal listedir (özel sektör çalışma hukuku), 1 Mayıs dışındaki günlerin çalışılmama zorunluluğu bunun anlamı değildir.
