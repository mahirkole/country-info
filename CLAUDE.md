# country-info – çalışma notları

Ülkeler/idari bölgeler/tatiller için sürümlü veri servisi (TypeScript, Fastify, PostgreSQL). Ayrıntı: `README.md`, `docs/DESIGN.md`.

**Oturuma başlarken önce `docs/ROADMAP.md` dosyasını okuyun** (kalan işler ve ağ gerektirenler orada) ve bitirdiğiniz işi oradan güncelleyin.

## Değişmez kurallar
- **Veri kaynağı eklemeden önce lisansını kaynak sayfasından okuyun** ve `docs/LICENSES.md`'ye yazın. Lisansı belirsiz/ticari kısıtlı kaynaktan (PTT, NVİ, TÜİK, GISCO "administrative units", OSM şart kontrolü olmadan) veri almayın.
- Her `Source` için `attribution` doldurun; `/v1/sources` ve `ATTRIBUTION.md` buradan beslenir.
- Tatil kayıtlarında `verification: verified` **yalnızca** atıf yapılan resmi metin gerçekten okunduysa (`source.checked_on` ve `url` dolu) kullanılır. Nager.Date yalnızca alarmdır, veri kaynağı değildir.
- Bilmediğiniz resmi bilgiyi hafızadan yazmayın; okuyamadığınız şeyi `unverified` bırakın ve belgeleyin.
- `ingest()` kaynağın kendi kayıtlarını siler; başka kaynağın kimliğini sahiplenmez. Silme koruması %5.

## Komutlar
`npm run ingest | ingest:gisco | ingest:holidays | link | check:holidays | export | serve`, `npm test` (+ `TEST_DATABASE_URL`), `npx tsc --noEmit -p .`
