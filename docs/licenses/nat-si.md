# Lisans dossier'i: nat-si

> Hukuki görüş değildir. Okuyan: Claude, 2026-10-05 (SURS metni üretici tarafından yeniden çekildi); alt-ajan raporu yalnızca yönlendirme. Bağımsız ikinci geçiş: hayır.

- **Yayıncı / veri seti:** Statistični urad Republike Slovenije (SURS) — SiStat PxWeb tablosu 2640010S ("Selected data on municipalities", `https://pxweb.stat.si/SiStatData/api/v1/en/Data/2640010S.px`); yalnızca `OBČINE` değişkeninin kodları ve adları (212 belediye) alınır.
- **Lisans (yayıncı sayfası, https://www.stat.si/StatWeb/en/StaticPages/Index/Copyright):** "…data and information may be used free of charge: to reproduce, distribute, and make them available to the public in their original or modified form, to adapt, modify, and create derivative works and incorporate them into other products and services, and to use them for any purpose, including forprofit (commercial) and nonprofit purposes, without any restrictions on condition that whenever the data or information are used the Statistical Office of the Republic of Slovenia (or SURS) is acknowledged as their source." Atıf: "Source: Statistical Office of the Republic of Slovenia" / "Source: SURS". Değiştirilen veri kullanıcının türev çalışması olarak belirtilmeli.
- **Ticari/yeniden dağıtım/türev DB:** evet. SA/NC yok. Üçüncü taraf bağlantıları kapsam dışı.
- **Resmi sayı:** 212 belediye (gov.si "Občine v številkah": "V Sloveniji deluje 212 občin"); SURS tablosu 212 + '0' (ülke satırı).
- **Hız limiti:** PxWeb yapılandırması `maxCalls 500 / timeWindow 10 sn` (alt-ajan okudu); bir çağrı kullanıyoruz.
- **Boşluklar:** tabloda üst bölge (statistik bölge) özniteliği yok → belediyeler doğrudan ülkeye bağlı; SURS kodu LAU kodu değil.
- **Karar: 🟢.**
