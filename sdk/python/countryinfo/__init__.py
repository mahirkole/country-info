"""Minimal Python client for the country-info API (standard library only).

    from countryinfo import CountryInfo
    c = CountryInfo("https://api.example.com", api_key="ci_...")
    for country in c.countries(): ...
    for change in c.changes(since=0): ...
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Dict, Iterator, Optional

__all__ = ["CountryInfo", "ApiError"]


class ApiError(Exception):
    def __init__(self, status: int, body: Any, url: str):
        super().__init__(f"GET {url}: {status}")
        self.status = status
        self.body = body


class CountryInfo:
    def __init__(self, base_url: str, api_key: Optional[str] = None, timeout: float = 30.0,
                 sleep: Callable[[float], None] = time.sleep):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self._sleep = sleep
        self.last_cursor = 0  # resume point after iterating `changes`

    def get(self, path: str, **query: Any) -> Any:
        qs = urllib.parse.urlencode({k: v for k, v in query.items() if v is not None})
        url = f"{self.base_url}{path}" + (f"?{qs}" if qs else "")
        headers = {"accept": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        for attempt in range(2):
            req = urllib.request.Request(url, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as res:
                    return json.loads(res.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt == 0:  # one polite retry after Retry-After
                    self._sleep(min(float(e.headers.get("retry-after") or 1), 60))
                    continue
                try:
                    body = json.loads(e.read().decode("utf-8"))
                except Exception:
                    body = None
                raise ApiError(e.code, body, url) from None
        raise AssertionError("unreachable")

    def paginate(self, path: str, **query: Any) -> Iterator[Dict[str, Any]]:
        after = None
        while True:
            page = self.get(path, after=after, **query)
            yield from page["data"]
            if not page.get("has_more") or page.get("next_after") is None:
                return
            after = page["next_after"]

    # --- endpoints -------------------------------------------------------
    def countries(self, **q: Any) -> Iterator[Dict[str, Any]]:
        return self.paginate("/v1/countries", **q)

    def country(self, code: str) -> Dict[str, Any]:
        return self.get(f"/v1/countries/{urllib.parse.quote(code)}")

    def regions(self, code: str, **q: Any) -> Iterator[Dict[str, Any]]:
        return self.paginate(f"/v1/countries/{urllib.parse.quote(code)}/regions", **q)

    def divisions(self, code: str, **q: Any) -> Iterator[Dict[str, Any]]:
        return self.paginate(f"/v1/countries/{urllib.parse.quote(code)}/divisions", **q)

    def region(self, region_id: str) -> Dict[str, Any]:
        return self.get(f"/v1/regions/{urllib.parse.quote(region_id)}")

    def children(self, region_id: str, **q: Any) -> Iterator[Dict[str, Any]]:
        return self.paginate(f"/v1/regions/{urllib.parse.quote(region_id)}/children", **q)

    def search(self, q: str, **kw: Any) -> Dict[str, Any]:
        return self.get("/v1/search", q=q, **kw)

    def holidays(self, code: str, year: Optional[int] = None, **kw: Any) -> Dict[str, Any]:
        return self.get(f"/v1/countries/{urllib.parse.quote(code)}/holidays", year=year, **kw)

    def sources(self) -> Dict[str, Any]:
        return self.get("/v1/sources")

    def status(self) -> Dict[str, Any]:
        return self.get("/v1/status")

    def changes(self, since: int = 0, **q: Any) -> Iterator[Dict[str, Any]]:
        """Yield changes after `since`; afterwards `self.last_cursor` is the cursor to resume from."""
        cursor = since
        while True:
            feed = self.get("/v1/changes", since=cursor, **q)
            yield from feed["data"]
            cursor = feed["next_seq"]
            self.last_cursor = cursor
            if not feed.get("has_more"):
                return
