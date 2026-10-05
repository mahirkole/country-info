"""Minimal Python client for the country-info API (standard library only).

    from countryinfo import CountryInfo
    c = CountryInfo("https://api.example.com", api_key="ci_...")
    for country in c.countries(): ...
    for change in c.changes(since=0): ...
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Dict, Iterator, Optional

__all__ = ["CountryInfo", "ApiError", "verify_webhook"]


class ApiError(Exception):
    def __init__(self, status: int, body: Any, url: str):
        super().__init__(f"{url}: {status}")
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
        return self.request("GET", path, None, **query)

    def request(self, method: str, path: str, body: Any = None, **query: Any) -> Any:
        """Any call; `body` is sent as JSON. A 204 answers None."""
        qs = urllib.parse.urlencode({k: v for k, v in query.items() if v is not None})
        url = f"{self.base_url}{path}" + (f"?{qs}" if qs else "")
        headers = {"accept": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        data = None
        if body is not None:
            headers["content-type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        for attempt in range(2):
            req = urllib.request.Request(url, headers=headers, method=method, data=data)
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as res:
                    raw = res.read().decode("utf-8")
                    return json.loads(raw) if raw else None
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

    # --- webhooks (your own subscriptions) -------------------------------
    # --- scopes, metadata and composed profiles ----------------------------
    def scopes(self) -> Dict[str, Any]:
        return self.get("/v1/scopes")

    def scope(self, scope_id: str) -> Dict[str, Any]:
        return self.get(f"/v1/scopes/{urllib.parse.quote(scope_id)}")

    def schema(self, **q: Any) -> Dict[str, Any]:
        """Global metadata, or metadata of `countries="TR,DE"` (mode="union"|"intersect")."""
        return self.get("/v1/schema", **q)

    def country_schema(self, code: str, **q: Any) -> Dict[str, Any]:
        return self.get(f"/v1/schema/countries/{urllib.parse.quote(code)}", **q)

    def profile(self, countries: str, scopes: Optional[str] = None, **q: Any) -> Dict[str, Any]:
        """Data of several countries for the chosen scopes, e.g. profile("TR,DE", "currency,datetime", mode="intersect")."""
        return self.get("/v1/profile", countries=countries, scopes=scopes, **q)

    def create_scope_profile(self, name: str, scopes: Optional[list] = None, countries: Optional[list] = None, mode: str = "union", locale: Optional[str] = None, default: bool = False) -> Dict[str, Any]:
        body = {"name": name, "scopes": scopes, "countries": countries, "mode": mode, "locale": locale, "default": default}
        return self.request("POST", "/v1/scope-profiles", {k: v for k, v in body.items() if v is not None})

    def scope_profiles(self) -> list:
        return self.get("/v1/scope-profiles")["data"]

    def delete_scope_profile(self, profile_id: Any) -> None:
        self.request("DELETE", f"/v1/scope-profiles/{profile_id}")

    def create_webhook(self, url: str, events: Optional[list] = None, countries: Optional[list] = None, kinds: Optional[list] = None) -> Dict[str, Any]:
        body = {k: v for k, v in {"url": url, "events": events, "countries": countries, "kinds": kinds}.items() if v is not None}
        return self.request("POST", "/v1/webhooks", body)

    def webhooks(self) -> list:
        return self.get("/v1/webhooks")["data"]

    def delete_webhook(self, webhook_id: Any) -> None:
        self.request("DELETE", f"/v1/webhooks/{webhook_id}")

    def webhook_deliveries(self, webhook_id: Any, **q: Any) -> Dict[str, Any]:
        """Delivery log, newest first; pass before=<next_before> to continue."""
        return self.get(f"/v1/webhooks/{webhook_id}/deliveries", **q)

    def replay_delivery(self, webhook_id: Any, delivery_id: Any) -> Dict[str, Any]:
        return self.request("POST", f"/v1/webhooks/{webhook_id}/deliveries/{delivery_id}/replay")

    def test_webhook(self, webhook_id: Any) -> Dict[str, Any]:
        return self.request("POST", f"/v1/webhooks/{webhook_id}/test")

    # --- release notes and file bundles ----------------------------------
    def releases(self, **q: Any) -> Iterator[Dict[str, Any]]:
        before = None
        while True:
            page = self.get("/v1/releases", before=before, **q)
            yield from page["data"]
            if not page.get("has_more") or page.get("next_before") is None:
                return
            before = page["next_before"]

    def release(self, release_id: Any) -> Dict[str, Any]:
        return self.get(f"/v1/releases/{release_id}")

    def exports_latest(self) -> Dict[str, Any]:
        return self.get("/v1/exports/latest")

    def download(self, file: Dict[str, Any]) -> bytes:
        """Download one file of a bundle (bundle["files"][name] or a snapshot's "delta") and verify its sha256."""
        with urllib.request.urlopen(file["url"], timeout=self.timeout) as res:
            data = res.read()
        got = hashlib.sha256(data).hexdigest()
        if got != file["sha256"]:
            raise ValueError(f"sha256 mismatch for {file['url']}: expected {file['sha256']}, got {got}")
        return data

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


def verify_webhook(secret: str, body: str, timestamp: str, signature: str, tolerance_sec: int = 300, now: Optional[float] = None) -> bool:
    """Check a delivery in your receiver: the x-countryinfo-signature / -timestamp headers and the raw body."""
    if abs((time.time() if now is None else now) - float(timestamp)) > tolerance_sec:
        return False
    mac = hmac.new(secret.encode(), f"{timestamp}.{body}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(mac, signature.removeprefix("sha256=") if hasattr(str, "removeprefix") else signature.replace("sha256=", "", 1))
