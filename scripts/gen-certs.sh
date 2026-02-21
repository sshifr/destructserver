#!/usr/bin/env bash
# Генерация самоподписанного SSL-сертификата для nginx.
# После запуска откройте сайт по https://localhost или https://ВАШ_IP — камера будет доступна.
# Браузер покажет предупреждение о сертификате — выберите «Дополнительно» → «Перейти на сайт».

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
CERTS_DIR="$(dirname "$DIR")/certs"
mkdir -p "$CERTS_DIR"
cd "$CERTS_DIR"

# SAN: localhost и опционально IP (например 192.168.1.70)
SAN="DNS:localhost,DNS:destructserver.local,IP:127.0.0.1"
if [ -n "$1" ]; then
  SAN="${SAN},IP:${1}"
fi

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key -out server.crt \
  -subj "/CN=destructserver.local" \
  -addext "subjectAltName=${SAN}"

echo "Сертификаты созданы в $CERTS_DIR (server.crt, server.key)."
echo "Перезапустите: docker compose restart nginx"
