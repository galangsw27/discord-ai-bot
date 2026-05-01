#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-ghcr.io/galangsw27/discord-ai-bot:latest}"
SERVICE="${SERVICE:-mili-bot}"

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found in $(pwd)"
  exit 1
fi

if [[ -z "${DISCORD_TOKEN:-}" ]]; then
  echo "INFO: DISCORD_TOKEN not set in shell. Using env_file from docker-compose.yml"
fi

echo "[1/4] Pull image: ${IMAGE}"
docker compose pull

echo "[2/4] Recreate container"
docker compose up -d --remove-orphans

echo "[3/4] Show status"
docker compose ps

echo "[4/4] Tail logs (last 120)"
docker compose logs --tail=120 "${SERVICE}"
