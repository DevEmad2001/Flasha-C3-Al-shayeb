#!/bin/bash
# Run once as root on VPS. Points alshaib.turbo-erp.com → AlShaib (:8082/:5200) only.
set -euo pipefail

SRC="/home/adminftp/AlShaibHousing/deploy/nginx-alshaib-turbo-erp.conf"
DST="/etc/nginx/sites-available/alshaib-turbo-erp"
ENABLED="/etc/nginx/sites-enabled/alshaib-turbo-erp"

if [[ "$(id -u)" -ne 0 ]]; then
  echo ""
  echo "ERROR: Run as root (Contabo VNC or: ssh root@194.163.157.119)"
  echo "  bash /home/adminftp/AlShaibHousing/deploy/install-alshaib-domain-root.sh"
  echo ""
  exit 1
fi

[[ -f "$SRC" ]] || { echo "Missing $SRC"; exit 1; }

cp "$SRC" "$DST"
ln -sf "$DST" "$ENABLED"
nginx -t
systemctl reload nginx

if [[ ! -f "/etc/letsencrypt/live/alshaib.turbo-erp.com/fullchain.pem" ]]; then
  certbot --nginx -d alshaib.turbo-erp.com --non-interactive --agree-tos --register-unsafely-without-email || true
fi

nginx -t
systemctl reload nginx

echo "OK: https://alshaib.turbo-erp.com -> web :8082, api :5200"
echo "mq-erp.com unchanged -> :8080"
echo "tr.turbo-erp.com unchanged -> :8081"
