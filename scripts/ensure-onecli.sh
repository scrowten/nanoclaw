#!/usr/bin/env bash
# Wait for Docker + OneCLI to be ready before NanoClaw starts.
# Used as ExecStartPre in nanoclaw.service.

set -euo pipefail

DOCKER_TIMEOUT=60
ONECLI_TIMEOUT=30
ONECLI_COMPOSE="$HOME/.onecli/docker-compose.yml"

log() { echo "[ensure-onecli] $*" >&2; }

# Step 1: Wait for Docker socket
log "Waiting for Docker..."
deadline=$((SECONDS + DOCKER_TIMEOUT))
until docker info &>/dev/null 2>&1; do
  if [ $SECONDS -ge $deadline ]; then
    log "ERROR: Docker not ready after ${DOCKER_TIMEOUT}s"
    exit 1
  fi
  sleep 2
done
log "Docker is ready."

# Step 2: Ensure OneCLI containers are up (idempotent)
if [ -f "$ONECLI_COMPOSE" ]; then
  log "Starting OneCLI containers..."
  docker compose -f "$ONECLI_COMPOSE" up -d 2>&1 | sed 's/^/[ensure-onecli] /' >&2 || true
else
  log "WARNING: OneCLI compose file not found at $ONECLI_COMPOSE — skipping"
fi

# Step 3: Wait for OneCLI API to respond
log "Waiting for OneCLI API..."
deadline=$((SECONDS + ONECLI_TIMEOUT))
until curl -sf --max-time 3 http://localhost:10254 &>/dev/null; do
  # Fallback: check container health status
  if docker ps --filter name=onecli --filter health=healthy --format "{{.Names}}" 2>/dev/null | grep -q onecli; then
    log "OneCLI healthy (via Docker health check)."
    break
  fi
  if [ $SECONDS -ge $deadline ]; then
    log "WARNING: OneCLI not responding after ${ONECLI_TIMEOUT}s — NanoClaw will start anyway"
    exit 0  # Don't block startup; NanoClaw has its own retry logic
  fi
  sleep 2
done
log "OneCLI is ready."
