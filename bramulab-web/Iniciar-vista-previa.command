#!/bin/bash
# BRAMUlab Web · vista previa LOCAL (solo red Wi-Fi de tu casa; no se publica nada en Internet).
# Doble clic para iniciar. Cerrá esta ventana (o Ctrl+C) para detener.
cd "$(dirname "$0")/public" || exit 1   # el sitio público vive en public/
PORT=8080
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT+1)); done
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
clear
echo "==============================================="
echo "  BRAMUlab Web · vista previa local"
echo "==============================================="
echo
echo "  En esta Mac:      http://localhost:$PORT"
if [ -n "$IP" ]; then
  echo "  En tu iPhone:     http://$IP:$PORT"
  echo "                    (iPhone en el MISMO Wi-Fi que esta Mac)"
else
  echo "  No encontré la dirección de Wi-Fi de la Mac."
  echo "  Conectá la Mac a tu Wi-Fi y volvé a abrir este archivo."
fi
echo
echo "  Para detener: cerrá esta ventana o presioná Ctrl+C."
echo "==============================================="
( sleep 1; open "http://localhost:$PORT" ) &
# Servidor local simple, sin caché (así Safari siempre muestra la última versión).
exec /usr/bin/python3 - "$PORT" <<'PY'
import sys, http.server, socketserver
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("0.0.0.0", int(sys.argv[1])), H) as s:
    s.serve_forever()
PY
