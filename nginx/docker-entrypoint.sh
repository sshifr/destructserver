#!/bin/sh
# Создаём самоподписанный сертификат при первом запуске, если его ещё нет
if [ ! -f /etc/nginx/certs/server.crt ]; then
  echo "Creating self-signed SSL certificate in /etc/nginx/certs ..."
  mkdir -p /etc/nginx/certs
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/certs/server.key -out /etc/nginx/certs/server.crt \
    -subj "/CN=destructserver.local" \
    -addext "subjectAltName=DNS:localhost,DNS:destructserver.local,IP:127.0.0.1"
fi
exec "$@"
