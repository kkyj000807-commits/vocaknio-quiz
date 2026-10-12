"""Loopback-only static QA server; no learner records or production writes."""
import http.server
import pathlib
import sys
import urllib.parse

root = pathlib.Path(sys.argv[1]).resolve()
if not (root / "release.json").is_file():
    raise SystemExit("Expected an audited static output")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)

    def do_GET(self):
        request = urllib.parse.urlsplit(self.path)
        route = request.path
        prefix = "/vocaknio-quiz"
        if route == prefix or route.startswith(prefix + "/"):
            route = route[len(prefix):] or "/"
        if route.endswith("/"):
            route += "index.html"
        elif not pathlib.PurePosixPath(route).suffix:
            route += ".html"
        self.path = route
        super().do_GET()

    def log_message(self, *_args):
        pass

http.server.ThreadingHTTPServer(("127.0.0.1", 26729), Handler).serve_forever()
