# SSH Server Access Reference

Auth: SSH keys mounted read-only at `~/.ssh/`. Use the host aliases below — do NOT specify keys manually.

## Available Servers

| Alias | Host | User | Purpose |
|-------|------|------|---------|
| staging | 192.168.1.175 | lubuntus | PropOps staging, Airflow staging, OSRM |
| jenkins | 192.168.1.201 | mindopropops | Jenkins CI/CD, production deploys |
| dev | 192.168.1.56 | risky | General debugging, maintenance |

## Connection

```bash
ssh staging
ssh jenkins
ssh dev
```

## Common Operations

### Check service status
```bash
ssh staging "systemctl status propops-webapp"
```

### View recent logs
```bash
ssh staging "journalctl -u propops-webapp --since '1 hour ago' --no-pager -n 50"
```

### Check disk and memory
```bash
ssh staging "df -h && free -m"
```

### Check running processes
```bash
ssh staging "ps aux | grep -E 'node|python|java' | grep -v grep"
```

### OSRM service (staging only)
```bash
ssh staging "systemctl status osrm"
ssh staging "sudo systemctl restart osrm"
```

## Safety Rules

- Read-only operations (logs, status, disk, processes) do NOT need approval
- Write operations (restart services, deploy, config changes) REQUIRE approval
- ALWAYS verify which server you are on before running destructive commands
- NEVER modify production configs without explicit human approval
- If unsure, ask the user before proceeding
