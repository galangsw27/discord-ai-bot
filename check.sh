#!/usr/bin/env bash
set -euo pipefail

SERVICE="${SERVICE:-mili-bot}"

echo "== docker compose ps =="
docker compose ps

echo
echo "== last 100 logs =="
docker compose logs --tail=100 "${SERVICE}"
