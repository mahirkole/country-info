# countryinfo (Python)

Standard-library-only client for the country-info API. Source: `countryinfo/__init__.py`.

```python
from countryinfo import CountryInfo
c = CountryInfo("https://api.example.com", api_key="...")
for country in c.countries(): print(country["code"])
profile = c.profile("TR,DE", "currency,datetime", mode="intersect")
```

Tests: `python3 -m unittest discover -s tests`. Publishing needs the registry account and license decision (docs/ROADMAP.md, section C).
