#!/usr/bin/env bash
# NanoClaw post-reboot diagnostic checklist
# Run this after any reboot to see what's broken

set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

pass() { echo -e "${GREEN}✓ PASS${NC}  $1"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}✗ FAIL${NC}  $1"; FAIL=$((FAIL + 1)); }
warn() { echo -e "${YELLOW}! WARN${NC}  $1"; }

echo "========================================"
echo "  NanoClaw Diagnostics"
echo "  $(date)"
echo "========================================"
echo ""

# 1. systemd
if systemctl is-system-running --quiet 2>/dev/null || systemctl is-system-running 2>/dev/null | grep -qE "running|degraded"; then
  pass "systemd is running"
else
  fail "systemd is not running ($(systemctl is-system-running 2>/dev/null || echo 'unknown'))"
fi

# 2. Docker daemon
if systemctl is-active --quiet docker 2>/dev/null; then
  pass "Docker service is active"
else
  fail "Docker service is not active — run: sudo systemctl start docker"
fi

# 3. Docker socket access
if docker info &>/dev/null; then
  pass "Docker socket is accessible"
else
  fail "Cannot talk to Docker socket — run: sudo setfacl -m u:$(whoami):rw /var/run/docker.sock"
fi

# 4. OneCLI containers
ONECLI_STATUS=$(docker compose -f ~/.onecli/docker-compose.yml ps --format json 2>/dev/null || echo "")
if echo "$ONECLI_STATUS" | grep -q '"State":"running"'; then
  pass "OneCLI containers are running"
else
  CONTAINERS=$(docker ps --filter name=onecli --format "{{.Names}}: {{.Status}}" 2>/dev/null)
  if echo "$CONTAINERS" | grep -q "Up"; then
    pass "OneCLI containers are up"
  else
    fail "OneCLI containers are not running — run: cd ~/.onecli && docker compose up -d"
  fi
fi

# 5. OneCLI API reachable
if curl -sf --max-time 5 http://localhost:10254 &>/dev/null; then
  pass "OneCLI API is reachable at localhost:10254"
else
  fail "OneCLI API not reachable at localhost:10254"
fi

# 6. OneCLI bound to 0.0.0.0 (required for Docker containers)
ONECLI_BIND=$(ss -tlnp | grep 10255 | awk '{print $4}' | head -1)
if echo "$ONECLI_BIND" | grep -q "0.0.0.0"; then
  pass "OneCLI proxy bound to 0.0.0.0:10255 (Docker-accessible)"
else
  fail "OneCLI proxy bound to $ONECLI_BIND — containers can't reach it. Check ~/.onecli/.env"
fi

# 7. NanoClaw service
if systemctl --user is-active --quiet nanoclaw 2>/dev/null; then
  pass "NanoClaw service is active"
else
  fail "NanoClaw service is not active — run: systemctl --user start nanoclaw"
fi

# 8. Mount allowlist
ALLOWLIST=~/.config/nanoclaw/mount-allowlist.json
if [ -f "$ALLOWLIST" ]; then
  if python3 -c "
import json, sys
data = json.load(open('$ALLOWLIST'))
roots = data.get('allowedRoots', [])
assert isinstance(roots, list), 'allowedRoots must be a list'
for r in roots:
    assert isinstance(r, dict) and 'path' in r, f'each allowedRoot must be an object with path key, got: {r}'
" 2>/dev/null; then
    pass "Mount allowlist is valid JSON with correct structure"
  else
    fail "Mount allowlist has wrong format — allowedRoots must be [{\"path\": \"...\"}] objects, not plain strings"
    warn "Fix: python3 -c \"import json; d=json.load(open('$ALLOWLIST')); d['allowedRoots']=[{'path':r} if isinstance(r,str) else r for r in d['allowedRoots']]; open('$ALLOWLIST','w').write(json.dumps(d,indent=2))\""
  fi
else
  warn "Mount allowlist not found at $ALLOWLIST (additional mounts disabled)"
fi

# 9. host.docker.internal resolution from container (HTTP check — ICMP may be blocked)
if docker run --rm --add-host=host.docker.internal:host-gateway --entrypoint sh \
    nanoclaw-agent:latest -c "curl -sf --max-time 5 http://host.docker.internal:10254 > /dev/null 2>&1 || curl -sf --max-time 5 http://host.docker.internal:10255 > /dev/null 2>&1" &>/dev/null; then
  pass "host.docker.internal resolves and is reachable inside containers"
else
  fail "host.docker.internal not reachable inside containers — OneCLI may not be bound to 0.0.0.0"
fi

# 10. OneCLI proxy reachable from inside container
PROXY_TEST=$(docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  --entrypoint sh \
  nanoclaw-agent:latest \
  -c "curl -sf --max-time 5 http://host.docker.internal:10255/ 2>&1; echo EXIT:$?" 2>/dev/null || echo "CONTAINER_FAILED")
if echo "$PROXY_TEST" | grep -qv "refused\|resolve\|CONTAINER_FAILED"; then
  pass "OneCLI proxy reachable from inside container"
else
  fail "OneCLI proxy NOT reachable from inside container at host.docker.internal:10255"
fi

# 11. loginctl linger
if loginctl show-user "$(whoami)" --property=Linger 2>/dev/null | grep -q "Linger=yes"; then
  pass "loginctl linger is enabled (services survive session end)"
else
  fail "loginctl linger is NOT enabled — run: loginctl enable-linger $(whoami)"
fi

echo ""
echo "========================================"
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
