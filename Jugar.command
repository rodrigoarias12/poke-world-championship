#!/bin/bash
# Doble clic para jugar: abre Poké World Championship en el navegador (mejor en Chrome)
cd "$(dirname "$0")"
python3 servidor.py 5173 &
SERVER=$!
sleep 1
if [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" "http://localhost:5173"
else
  open "http://localhost:5173"
fi
echo "Poké World Championship está abierto en el navegador. Cierra esta ventana para apagarlo."
wait $SERVER
