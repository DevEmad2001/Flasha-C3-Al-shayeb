#!/bin/bash
# Start AlShaib containers without docker-compose. Does NOT touch mq/flasha containers.
set -euo pipefail

BASE="/home/adminftp/AlShaibHousing"

echo "Stopping old AlShaib containers (if any)..."
docker rm -f alshaib-api alshaib-web 2>/dev/null || true

echo "Building alshaib-api..."
docker build -t alshaib-api:latest -f "$BASE/deploy/Dockerfile.api" "$BASE"

echo "Building alshaib-web..."
docker build -t alshaib-web:latest -f "$BASE/deploy/Dockerfile.web" "$BASE"

echo "Starting alshaib-api on :5200..."
docker run -d \
  --name alshaib-api \
  --network mq_default \
  --restart unless-stopped \
  -p 5200:5200 \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e ASPNETCORE_URLS=http://0.0.0.0:5200 \
  alshaib-api:latest

echo "Starting alshaib-web on :8082..."
docker run -d \
  --name alshaib-web \
  --network mq_default \
  --restart unless-stopped \
  -p 8082:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  alshaib-web:latest

echo "Waiting for health..."
sleep 10
curl -sf http://127.0.0.1:5200/api/health && echo " API OK" || echo " API not ready yet"
curl -sf -o /dev/null -w "Web HTTP %{http_code}\n" http://127.0.0.1:8082/ || true

docker ps --filter name=alshaib --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "Done."
