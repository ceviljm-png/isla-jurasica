"""Servidor local para jugar a Isla Jurásica.  Uso: python3 serve.py [puerto]"""
import functools
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8140


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map,
                          **{'.webmanifest': 'application/manifest+json', '.js': 'text/javascript'})

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    handler = functools.partial(Handler, directory=ROOT)
    with http.server.ThreadingHTTPServer(('0.0.0.0', PORT), handler) as httpd:
        print('Isla Jurásica en http://localhost:%d' % PORT)
        httpd.serve_forever()
