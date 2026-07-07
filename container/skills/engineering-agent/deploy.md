# Deployment Procedures

All deployments follow: staging first → verify → approval → production.
Paths below are placeholders — verify actual paths on first SSH connection.

## PropOps Webapp

### Deploy to Staging (SSH)
```bash
ssh staging "cd /opt/propops-webapp && git fetch origin && git checkout master && git pull && npm install && npm run build && sudo systemctl restart propops-webapp"
```

### Verify Staging
```bash
ssh staging "systemctl status propops-webapp --no-pager"
ssh staging "curl -sf http://localhost:3000/health || echo 'Health check failed'"
ssh staging "journalctl -u propops-webapp --since '2 minutes ago' --no-pager -n 20"
```

### Deploy to Production (Jenkins)
```bash
ssh jenkins "curl -s -X POST 'http://localhost:8080/job/<webapp-prod-job>/buildWithParameters?BRANCH=master'"
```

### Monitor Production Build
```bash
ssh jenkins "curl -s http://localhost:8080/job/<webapp-prod-job>/lastBuild/api/json" | jq '{number, result, building}'
```

## Airflow DAGs

### Deploy to Staging
```bash
ssh staging "cd /opt/airflow/dags && git fetch origin && git checkout master && git pull"
ssh staging "cd /opt/airflow && docker compose restart airflow-scheduler"
```

### Deploy to Production (Jenkins)
```bash
ssh jenkins "curl -s -X POST 'http://localhost:8080/job/<airflow-prod-job>/buildWithParameters?BRANCH=master'"
```

## Rollback

### Rollback Staging Webapp
```bash
ssh staging "cd /opt/propops-webapp && git checkout <previous-tag> && npm install && npm run build && sudo systemctl restart propops-webapp"
```

### Rollback Production (via Jenkins)
```bash
ssh jenkins "curl -s -X POST 'http://localhost:8080/job/<webapp-prod-job>/buildWithParameters?BRANCH=<known-good-tag>'"
```

## Safety Rules

- ALWAYS deploy to staging first, verify, get approval, then production
- NEVER deploy to production without explicit human approval
- ALWAYS have a rollback plan before deploying
- Monitor logs for 5 minutes after production deploy
- If anything looks wrong, trigger rollback immediately
- Post deployment status to chat at every step

## First-Time Setup

On first use, SSH into each server and verify:
1. Actual project paths (`find / -name propops-webapp -type d 2>/dev/null`)
2. Service names (`systemctl list-units | grep -i prop`)
3. Jenkins job names (`ssh jenkins "curl -s http://localhost:8080/api/json?tree=jobs[name]"`)
4. Read Confluence deployment page for the canonical workflow
