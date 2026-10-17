# Servidor local para jugar: igual que "python3 -m http.server" pero sin guardar
# copias viejas en el navegador (así siempre se ve la última versión del juego).
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), SinCache).serve_forever()
