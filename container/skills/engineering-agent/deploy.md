# Deployment Procedures

All deployments follow: staging first → verify → approval → production.

## PropOps Webapp

### Deploy to Staging (Jenkins)
```bash
ssh jenkins "curl -s -X POST http://localhost:8090/job/propops-webapp-pipeline-staging/build"
```

Staging deploys to `lubuntus@192.168.1.175`:
- Path: `/home/lubuntus/Documents/webapp-project/staging/propops-webapp`
- Branch: `Dev`

### Verify Staging
```bash
ssh staging "systemctl status propops-webapp --no-pager"
ssh staging "curl -sf http://localhost:3000/health || echo 'Health check failed'"
ssh staging "journalctl -u propops-webapp --since '2 minutes ago' --no-pager -n 20"
```

### Deploy to Production (Jenkins)
```bash
ssh jenkins "curl -s -X POST http://localhost:8090/job/propops-webapp-pipeline/build"
```

### Monitor Build
```bash
ssh jenkins "curl -s http://localhost:8090/job/propops-webapp-pipeline/lastBuild/api/json" | jq '{number, result, building}'
```

## Airflow DAGs

### Deploy to Staging (Jenkins)
```bash
ssh jenkins "curl -s -X POST http://localhost:8090/job/Airflow-CI-CD-staging/build"
```

### Deploy to Production (Jenkins)
```bash
ssh jenkins "curl -s -X POST http://localhost:8090/job/Airflow-CI-CD/build"
```

## Rollback

### Rollback via Jenkins (re-run previous successful build)
```bash
ssh jenkins "curl -s -X POST http://localhost:8090/job/propops-webapp-pipeline/<build-number>/replay"
```

### Rollback with specific branch/tag
```bash
ssh jenkins "curl -s -X POST 'http://localhost:8090/job/propops-webapp-pipeline/buildWithParameters?BRANCH=<known-good-tag>'"
```

## Pipeline Jobs

| Job Name | Purpose |
|----------|---------|
| `propops-webapp-pipeline` | Deploy webapp to production |
| `propops-webapp-pipeline-staging` | Deploy webapp to staging |
| `Airflow-CI-CD` | Deploy Airflow to production |
| `Airflow-CI-CD-staging` | Deploy Airflow to staging |

## Safety Rules

- ALWAYS deploy to staging first, verify, get approval, then production
- NEVER deploy to production without explicit human approval
- ALWAYS have a rollback plan before deploying
- Monitor logs for 5 minutes after production deploy
- If anything looks wrong, trigger rollback immediately
- Post deployment status to chat at every step
