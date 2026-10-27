#!/usr/bin/env python3
"""Optional lightweight Python static server for built Road Rash '96 files (dist/)."""
import http.server
import os
import socketserver
import sys

PORT = int(os.environ.get("PORT", "8080"))
DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

if not os.path.isdir(DIST_DIR):
    print("Note: 'dist/' not found yet. Run `npm install && npm run build` first, or use `npm run dev`.")
    sys.exit(1)

os.chdir(DIST_DIR)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Road Rash '96 running at http://0.0.0.0:{PORT}")
    httpd.serve_forever()
