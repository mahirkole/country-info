# Lisans dossier'i: nat-gr

> Hukuki görüş değildir. Okuyan: Claude, 2026-10-05 (ELSTAT politika PDF'i üretici tarafından indirilip okundu); alt-ajan raporu yalnızca yönlendirme. Bağımsız ikinci geçiş: hayır.

- **Yayıncı / veri seti:** Ελληνική Στατιστική Αρχή (ΕΛΣΤΑΤ) — "Μητρώο Οικισμών" (SKA01, `A1202_SKA01_TB_AN_00_2026_01_F_GR.xls`, "Διοικητική διαίρεση της χώρας, ενημέρωση μέχρι 31/12/2025"); sayfalar: Περιφέρειες (NUTS 2), Περιφερειακές Ενότητες, Δήμοι. Alt seviyeler (Δημοτικές Ενότητες, Κοινότητες, Οικισμοί) ALINMIYOR.
- **Lisans (ELSTAT "Copyright & Reuse Policy" PDF, https://www.statistics.gr/documents/20181/1412103/Copyright_Reuse_Policy_GR.pdf/98190155-becf-45d1-9366-a157d44af50b):** "Η Ελληνική Στατιστική Αρχή (ΕΛΣΤΑΤ) ενθαρρύνει την ελεύθερη επαναχρησιμοποίηση των στοιχείων της, τόσο για μη εμπορικούς όσο και για εμπορικούς σκοπούς. … μπορούν να επαναχρησιμοποιηθούν χωρίς καμία πληρωμή ή γραπτή άδεια, υπό τις ακόλουθες προϋποθέσεις: Αναφέρεται η πηγή τους. Όταν η επαναχρησιμοποίηση περιλαμβάνει οποιαδήποτε τροποποίηση στοιχείων ή κειμένου… αυτό αναφέρεται σαφώς στον τελικό χρήστη… καθώς και ότι δεν υπάρχει ευθύνη της ΕΛΣΤΑΤ για το αποτέλεσμα της τροποποίησης." Hariç: üçüncü taraf telifli materyal; ELSTAT logosu.
- **Ticari/yeniden dağıtım/türev DB:** evet (özel izin verici politika, CC değil). SA/NC yok. **Atıf:** "Πηγή: ΕΛΣΤΑΤ"; değişiklik belirtilmeli.
- **Boşluk:** PDF 2016 tarihli (ELSTAT'ın bugün bağladığı politika); yayıncı sayfasında hız limiti yok; indirme URL'si portlet kimlikli (sayfadan kazınır).
- **Sayılar:** 13 περιφέρεια, 75 περιφερειακή ενότητα (74 + Άγιο Όρος), 333 δήμος (332 + Άγιο Όρος, özerk — `data.status=autonomous`). Resmî "332" cümlesi ELSTAT sayfalarında okunamadı (JS); kayıt resmi register ile uyumlu.
- **Teknik:** dosya `.xls` (BIFF8) → `src/sources/xls.ts` (cfb ile). Sayfa HTML'i ham-girdi hash'ine dahil edilmez (istek başına belirteç içerir).
- **Karar: 🟢.**
