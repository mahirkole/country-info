import json
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from countryinfo import ApiError, CountryInfo  # noqa: E402

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
        self._send(404, {"error": "not_found"})


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


if __name__ == "__main__":
    unittest.main()
