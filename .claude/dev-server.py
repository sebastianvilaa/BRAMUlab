import http.server
import socketserver
import functools
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVE_DIR = os.path.join(BASE_DIR, '..', 'bramu-lab')

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=SERVE_DIR)
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', 4173), Handler) as httpd:
    httpd.serve_forever()
