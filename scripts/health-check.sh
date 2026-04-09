#!/usr/bin/env bash
# NanoClaw health check — outputs JSON for programmatic use
# Written to data/host-health.json periodically by NanoClaw

docker_ok=false
onecli_ok=false
nanoclaw_ok=false
host_gateway_ok=false

docker info &>/dev/null && docker_ok=true
curl -sf --max-time 3 http://localhost:10254 &>/dev/null && onecli_ok=true
systemctl --user is-active --quiet nanoclaw 2>/dev/null && nanoclaw_ok=true
docker run --rm --add-host=host.docker.internal:host-gateway --entrypoint sh \
  nanoclaw-agent:latest -c "ping -c1 -W2 host.docker.internal" &>/dev/null 2>&1 \
  && host_gateway_ok=true

UPTIME_SECONDS=$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo 0)

cat <<EOF
{
  "docker": $docker_ok,
  "onecli": $onecli_ok,
  "nanoclaw": $nanoclaw_ok,
  "host_gateway": $host_gateway_ok,
  "uptime_seconds": $UPTIME_SECONDS,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
