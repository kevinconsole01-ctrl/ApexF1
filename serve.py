#!/usr/bin/env python3
"""Server statico minimo per APEX · F1 Stats.

Uso:
    python3 serve.py                 # http://localhost:8000 e rete locale
    python3 serve.py --port 8080
    python3 serve.py --bind 127.0.0.1

Non richiede dipendenze: usa solo la libreria standard di Python 3.9+.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import os
import socket
import socketserver
import sys
import urllib.parse


class ApexHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".webmanifest": "application/manifest+json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".ico": "image/x-icon",
        ".txt": "text/plain; charset=utf-8",
        ".md": "text/markdown; charset=utf-8",
    }

    def end_headers(self) -> None:
        # In sviluppo evitiamo cache aggressiva: il service worker aggiorna presto.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Service-Worker-Allowed", "/")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def send_head(self):
        # Fallback SPA: percorsi senza estensione servono index.html.
        # Il router usa l'hash, quindi normalmente non serve, ma evita 404
        # se un link viene aperto senza cancelletto.
        path = self.translate_path(self.path)
        if not os.path.exists(path) and not os.path.splitext(urllib.parse.urlsplit(self.path).path)[1]:
            self.path = "/index.html"
        return super().send_head()

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("  %s\n" % (fmt % args))


def lan_ip() -> str | None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return None
    finally:
        sock.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Server locale per APEX · F1 Stats")
    parser.add_argument("--port", type=int, default=8000, help="porta HTTP (default: 8000)")
    parser.add_argument("--bind", default="0.0.0.0", help="indirizzo di ascolto (default: 0.0.0.0)")
    parser.add_argument("--dir", default=".", help="cartella da servire (default: corrente)")
    args = parser.parse_args()

    root = os.path.abspath(args.dir)
    if not os.path.isdir(root):
        print(f"Cartella non trovata: {root}", file=sys.stderr)
        return 1

    os.chdir(root)
    handler = functools.partial(ApexHandler, directory=root)

    socketserver.TCPServer.allow_reuse_address = True
    try:
        with http.server.ThreadingHTTPServer((args.bind, args.port), handler) as server:
            print()
            print("  APEX · F1 STATS — server locale")
            print(f"  Cartella: {root}")
            print()
            print(f"  Desktop:  http://localhost:{args.port}")
            if args.bind in ("0.0.0.0", "::"):
                ip = lan_ip()
                if ip:
                    print(f"  Mobile:   http://{ip}:{args.port}  (stessa rete Wi-Fi)")
            print()
            print("  Nota: per installare la PWA su mobile serve HTTPS.")
            print("  Su localhost l'installazione funziona anche in HTTP.")
            print("  Premi Ctrl+C per fermare il server.")
            print()
            server.serve_forever()
    except OSError as error:
        print(f"Impossibile avviare il server: {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nServer fermato.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
