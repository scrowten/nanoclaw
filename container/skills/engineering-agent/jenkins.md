# Jenkins REST API Reference

Base URL: `http://192.168.1.201:8080`
Auth: Access Jenkins via SSH tunnel since OneCLI only proxies HTTPS. Use: `ssh jenkins "curl -s http://localhost:8080/..."`

If Jenkins credentials are available as env vars, use direct curl with Basic auth.

## Trigger Build

### Simple build
```bash
ssh jenkins "curl -s -X POST http://localhost:8080/job/<job-name>/build"
```

### Parameterized build
```bash
ssh jenkins "curl -s -X POST 'http://localhost:8080/job/<job-name>/buildWithParameters?BRANCH=master&DEPLOY_ENV=staging'"
```

## Get Build Status

### Last build
```bash
ssh jenkins "curl -s http://localhost:8080/job/<job-name>/lastBuild/api/json" | jq '{number, result, building, timestamp, duration}'
```

### Specific build
```bash
ssh jenkins "curl -s http://localhost:8080/job/<job-name>/<build-number>/api/json" | jq '{number, result, building}'
```

## Get Console Output

```bash
ssh jenkins "curl -s http://localhost:8080/job/<job-name>/<build-number>/consoleText" | tail -50
```

## List Jobs

```bash
ssh jenkins "curl -s http://localhost:8080/api/json?tree=jobs\[name,color\]" | jq '.jobs[] | {name, color}'
```

## Queue Status

```bash
ssh jenkins "curl -s http://localhost:8080/queue/api/json" | jq '.items[] | {id, task: .task.name, why}'
```

## Poll Build Until Complete

```bash
JOB=<job-name>
while true; do
  STATUS=$(ssh jenkins "curl -s http://localhost:8080/job/$JOB/lastBuild/api/json" | jq -r '.building')
  if [ "$STATUS" = "false" ]; then
    RESULT=$(ssh jenkins "curl -s http://localhost:8080/job/$JOB/lastBuild/api/json" | jq -r '.result')
    echo "Build finished: $RESULT"
    break
  fi
  sleep 30
done
```

## Key Jobs (verify actual names after first SSH connection)

| Job Name | Purpose | Parameters |
|----------|---------|------------|
| TBD | Deploy webapp to staging | BRANCH |
| TBD | Deploy webapp to production | BRANCH, CONFIRM |
| TBD | Deploy Airflow to staging | BRANCH |
| TBD | Deploy Airflow to production | BRANCH, CONFIRM |

## Rollback

### Re-run a previous successful build
```bash
ssh jenkins "curl -s -X POST http://localhost:8080/job/<job-name>/<build-number>/replay"
```

### Trigger build with known-good tag
```bash
ssh jenkins "curl -s -X POST 'http://localhost:8080/job/<job-name>/buildWithParameters?BRANCH=<known-good-tag>'"
```
