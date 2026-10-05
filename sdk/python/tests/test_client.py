import hashlib
import hmac
import json
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from countryinfo import ApiError, CountryInfo, verify_webhook  # noqa: E402

CALLS = []
RATE_LIMITED = {"once": True}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):  # quiet
        pass

    def _send(self, status, body, headers=None):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == "/dl/a.json":  # presigned link: no API key needed
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"{}")
            return
        CALLS.append((u.path, q, self.headers.get("x-api-key")))
        if self.headers.get("x-api-key") != "k1":
            return self._send(401, {"error": "unauthorized"})
        if u.path == "/v1/countries":
            after = q.get("after")
            items = ["DE", "FR", "TR"]
            i = items.index(after) + 1 if after else 0
            return self._send(200, {"data": [{"code": items[i]}], "has_more": i < 2, "next_after": items[i] if i < 2 else None})
        if u.path == "/v1/changes":
            since = int(q["since"])
            return self._send(200, {"data": [{"seq": since + 1}], "has_more": since < 1, "next_seq": since + 1, "head_seq": 2})
        if u.path == "/v1/status":
            if RATE_LIMITED["once"]:
                RATE_LIMITED["once"] = False
                return self._send(429, {"error": "rate_limited"}, {"retry-after": "1"})
            return self._send(200, {"ok": True})
        if u.path == "/v1/releases":
            before = q.get("before")
            return self._send(200, {"data": [{"id": 2 if not before else 1}], "has_more": not before, "next_before": "2" if not before else None})
        if u.path == "/v1/exports/latest":
            return self._send(200, {"files": {"a.json": {"url": f"http://127.0.0.1:{self.server.server_port}/dl/a.json", "sha256": hashlib.sha256(b"{}").hexdigest()}}})
        if u.path == "/v1/webhooks":
            return self._send(200, {"data": [{"id": 1}]})
        self._send(404, {"error": "not_found"})

    def _body(self):
        n = int(self.headers.get("content-length") or 0)
        return json.loads(self.rfile.read(n)) if n else None

    def do_POST(self):
        u = urlparse(self.path)
        CALLS.append((u.path, self._body(), self.headers.get("x-api-key")))
        if u.path == "/v1/webhooks":
            return self._send(201, {"id": 1, "secret": "s"})
        return self._send(202, {"id": 9, "status": "pending"})

    def do_DELETE(self):
        self.send_response(204)
        self.end_headers()


class ClientTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def test_pagination_cursor_key_retry_and_errors(self):
        sleeps = []
        c = CountryInfo(self.base, api_key="k1", sleep=sleeps.append)
        self.assertEqual([x["code"] for x in c.countries()], ["DE", "FR", "TR"])  # one item per page, cursor followed
        self.assertEqual([x["seq"] for x in c.changes(0)], [1, 2])
        self.assertEqual(c.last_cursor, 2)
        self.assertEqual(c.status(), {"ok": True})  # first call was 429 -> slept, retried once
        self.assertEqual(sleeps, [1.0])
        self.assertTrue(all(call[2] == "k1" for call in CALLS))
        with self.assertRaises(ApiError) as e:
            CountryInfo(self.base, api_key="bad").country("TR")
        self.assertEqual(e.exception.status, 401)

    def test_webhooks_releases_bundles_and_signature(self):
        CALLS.clear()
        c = CountryInfo(self.base, api_key="k1")
        self.assertEqual(c.create_webhook("https://r.test/h", events=["release.published"])["secret"], "s")
        self.assertEqual(CALLS[-1][1], {"url": "https://r.test/h", "events": ["release.published"]})  # None fields are not sent
        self.assertEqual(c.webhooks(), [{"id": 1}])
        self.assertIsNone(c.delete_webhook(1))  # 204
        self.assertEqual(c.replay_delivery(1, 5)["status"], "pending")
        self.assertEqual(c.test_webhook(1)["id"], 9)
        self.assertEqual([r["id"] for r in c.releases()], [2, 1])  # follows next_before
        bundle = c.exports_latest()
        self.assertEqual(c.download(bundle["files"]["a.json"]), b"{}")
        with self.assertRaises(ValueError):
            c.download({**bundle["files"]["a.json"], "sha256": "0" * 64})

        body, ts = '{"event":"x"}', "1700000000"
        sig = "sha256=" + hmac.new(b"sec", f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
        self.assertTrue(verify_webhook("sec", body, ts, sig, now=1700000100))
        self.assertFalse(verify_webhook("sec", body + " ", ts, sig, now=1700000100))
        self.assertFalse(verify_webhook("sec", body, ts, sig, now=1700009999))  # too old
        self.assertFalse(verify_webhook("other", body, ts, sig, now=1700000100))


if __name__ == "__main__":
    unittest.main()
