# country-info – çalışma notları

Ülkeler/idari bölgeler/tatiller için sürümlü veri servisi (TypeScript, Fastify, PostgreSQL). Ayrıntı: `README.md`, `docs/DESIGN.md`.

**Oturuma başlarken önce `docs/ROADMAP.md` dosyasını okuyun** (kalan işler ve ağ gerektirenler orada) ve bitirdiğiniz işi oradan güncelleyin.

## Değişmez kurallar
- **Veri kaynağı eklemeden önce lisansını kaynak sayfasından okuyun** ve `docs/LICENSES.md`'ye yazın. Lisansı belirsiz/ticari kısıtlı kaynaktan (PTT, NVİ, TÜİK, GISCO "administrative units", OSM şart kontrolü olmadan) veri almayın.
- Her `Source` için `attribution` doldurun; `/v1/sources` ve `ATTRIBUTION.md` buradan beslenir.
- Tatil kayıtlarında `verification: verified` **yalnızca** atıf yapılan resmi metin gerçekten okunduysa (`source.checked_on` ve `url` dolu) kullanılır. Nager.Date yalnızca alarmdır, veri kaynağı değildir.
- Bilmediğiniz resmi bilgiyi hafızadan yazmayın; okuyamadığınız şeyi `unverified` bırakın ve belgeleyin.
- `ingest()` kaynağın kendi kayıtlarını siler; başka kaynağın kimliğini sahiplenmez. Silme koruması %5.

- Ulusal kaynak (ülke adaptörü) eklerken `docs/sources/NATIONAL.md`'deki sırayı izleyin; `licenseStatus: 'unread'` kaynak yüklenmez, `partial` ise nedeni `meta.license`'a açıkça yazılır.
- İdari birimler `division` kind'ıdır (`data.level`, `data.type` ortak sözlükten `src/taxonomy.ts`, `data.type_local` yerel ad).

- Kaynak güncellemesi `docs/OPERATIONS.md`'deki `refresh` ile yapılır (ham hash, bant, vintage, lisans izleme); yeni kaynak `src/targets.ts`'e sıklık, satır bandı ve lisans sayfalarıyla eklenir.
- Her kaynağın lisans dossier'i `docs/licenses/<source-id>.md` (şablon: `TEMPLATE.md`); dossier'siz kaynak ticari pakete girmez.

## Komutlar
`npm run refresh [-- --due|--source id|--force|--dry-run] | check:sources | check:licenses | license:ack -- <id> | ingest | ingest:gisco | ingest:national <CC|all> | ingest:holidays | link | check:holidays | export | serve`, `npm test` (+ `TEST_DATABASE_URL`), `npx tsc --noEmit -p .`
