# country-info-client (TypeScript)

Dependency-free client (uses the global `fetch`, Node ≥ 18). The source is `src/sdk.ts` of this repository; `npm run build` in this directory compiles it to `dist/`.

```ts
import { CountryInfo } from 'country-info-client';
const client = new CountryInfo({ baseUrl: 'https://api.example.com', apiKey: process.env.KEY });
for await (const c of client.countries()) console.log(c.code);
const p = await client.profile({ countries: 'TR,DE', scopes: 'currency,datetime', mode: 'intersect' });
```

`private: true` and `license: UNLICENSED` are placeholders: publishing needs the registry account and license decision (docs/ROADMAP.md, section C).
