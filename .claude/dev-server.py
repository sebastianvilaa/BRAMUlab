import http.server
import socketserver
import functools
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVE_DIR = os.path.join(BASE_DIR, '..', 'bramulab')


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        http.server.SimpleHTTPRequestHandler.end_headers(self)


Handler = functools.partial(NoCacheHandler, directory=SERVE_DIR)
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', 4173), Handler) as httpd:
    httpd.serve_forever()
