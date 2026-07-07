# Jenkins REST API Reference

Base URL: `http://192.168.1.201:8090`
Auth: Access Jenkins via SSH tunnel since OneCLI only proxies HTTPS. Use: `ssh jenkins "curl -s http://localhost:8090/..."`

## Trigger Build

### Trigger webapp staging pipeline
```bash
ssh jenkins "curl -s -X POST http://localhost:8090/job/propops-webapp-pipeline-staging/build"
```

### Trigger webapp production pipeline
```bash
ssh jenkins "curl -s -X POST http://localhost:8090/job/propops-webapp-pipeline/build"
```

### Trigger Airflow staging pipeline
```bash
ssh jenkins "curl -s -X POST http://localhost:8090/job/Airflow-CI-CD-staging/build"
```

### Trigger Airflow production pipeline
```bash
ssh jenkins "curl -s -X POST http://localhost:8090/job/Airflow-CI-CD/build"
```

## Get Build Status

### Last build
```bash
ssh jenkins "curl -s http://localhost:8090/job/propops-webapp-pipeline/lastBuild/api/json" | jq '{number, result, building, timestamp, duration}'
```

### Specific build
```bash
ssh jenkins "curl -s http://localhost:8090/job/propops-webapp-pipeline/<build-number>/api/json" | jq '{number, result, building}'
```

## Get Console Output

```bash
ssh jenkins "curl -s http://localhost:8090/job/propops-webapp-pipeline/lastBuild/consoleText" | tail -50
```

## List Jobs

```bash
ssh jenkins "curl -s 'http://localhost:8090/api/json?tree=jobs\[name,color\]'" | jq '.jobs[] | {name, color}'
```

## Queue Status

```bash
ssh jenkins "curl -s http://localhost:8090/queue/api/json" | jq '.items[] | {id, task: .task.name, why}'
```

## Poll Build Until Complete

```bash
JOB=propops-webapp-pipeline
while true; do
  STATUS=$(ssh jenkins "curl -s http://localhost:8090/job/$JOB/lastBuild/api/json" | jq -r '.building')
  if [ "$STATUS" = "false" ]; then
    RESULT=$(ssh jenkins "curl -s http://localhost:8090/job/$JOB/lastBuild/api/json" | jq -r '.result')
    echo "Build finished: $RESULT"
    break
  fi
  sleep 30
done
```

## Pipeline Jobs

| Job Name | Purpose | Jenkinsfile |
|----------|---------|-------------|
| `propops-webapp-pipeline` | Deploy webapp to production | `Jenkinsfile.webapp` |
| `propops-webapp-pipeline-staging` | Deploy webapp to staging | `Jenkinsfile.webapp.staging` |
| `Airflow-CI-CD` | Deploy Airflow to production | `Jenkinsfile.airflow` |
| `Airflow-CI-CD-staging` | Deploy Airflow to staging | `Jenkinsfile.airflow.staging` |

Jenkinsfiles are at `/workspace/extra/propops-webapp/jenkins/`

## Staging Deployment Details

Staging deploys via SSH to `lubuntus@192.168.1.175`:
- Webapp path: `/home/lubuntus/Documents/webapp-project/staging/propops-webapp`
- Staging branch: `Dev`

## Rollback

### Re-run a previous successful build
```bash
ssh jenkins "curl -s -X POST http://localhost:8090/job/propops-webapp-pipeline/<build-number>/replay"
```

### Trigger build with known-good commit
```bash
ssh jenkins "curl -s -X POST 'http://localhost:8090/job/propops-webapp-pipeline/buildWithParameters?BRANCH=<known-good-tag>'"
```
