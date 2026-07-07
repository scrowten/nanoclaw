---
name: engineering-agent
description: Engineering SDLC tools — Jira, Bitbucket, Confluence, SSH servers, Jenkins CI/CD, and deployment automation.
---

# Engineering Agent Tools

This skill provides API references for the engineering workflow. HTTPS API calls use `curl` with OneCLI proxy auth injection. SSH access uses pre-mounted keys with host aliases. Jenkins is accessed via SSH tunnel.

## Jira

Read `/home/node/.claude/skills/engineering-agent/jira.md` for the full API reference.

Quick reference:
```bash
# Get issue details
curl -s "https://redawning.atlassian.net/rest/api/3/issue/PROP-123"

# Transition issue (move status)
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"transition": {"id": "<transition-id>"}}' \
  "https://redawning.atlassian.net/rest/api/3/issue/PROP-123/transitions"
```

## Bitbucket

Read `/home/node/.claude/skills/engineering-agent/bitbucket.md` for the full API reference.

Quick reference:
```bash
# Create pull request
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"title": "PROP-123: Fix widget", "source": {"branch": {"name": "feature/PROP-123-fix-widget"}}, "destination": {"branch": {"name": "master"}}}' \
  "https://api.bitbucket.org/2.0/repositories/redawning/propops-webapp/pullrequests"
```

## Confluence

Read `/home/node/.claude/skills/engineering-agent/confluence.md` for the full API reference.

Quick reference:
```bash
# Search for deployment docs
curl -s "https://redawning.atlassian.net/wiki/rest/api/content?title=Development+Deployment+Workflow&spaceKey=PO"
```

## SSH Servers

Read `/home/node/.claude/skills/engineering-agent/ssh.md` for the full reference.

Quick reference:
```bash
# Connect using aliases (keys are pre-mounted)
ssh staging    # lubuntus@192.168.1.175
ssh jenkins    # mindopropops@192.168.1.201
ssh dev        # risky@192.168.1.56

# Check service status
ssh staging "systemctl status propops-webapp"
```

## Jenkins CI/CD

Read `/home/node/.claude/skills/engineering-agent/jenkins.md` for the full API reference.

Quick reference:
```bash
# Trigger staging build (via SSH tunnel)
ssh jenkins "curl -s -X POST http://localhost:8090/job/propops-webapp-pipeline-staging/build"

# Trigger production build
ssh jenkins "curl -s -X POST http://localhost:8090/job/propops-webapp-pipeline/build"

# Check build status
ssh jenkins "curl -s http://localhost:8090/job/propops-webapp-pipeline/lastBuild/api/json" | jq '{number, result, building}'
```

## Deployment

Read `/home/node/.claude/skills/engineering-agent/deploy.md` for full procedures.

Quick reference:
```bash
# Deploy webapp to staging via Jenkins
ssh jenkins "curl -s -X POST http://localhost:8090/job/propops-webapp-pipeline-staging/build"

# Deploy webapp to production via Jenkins
ssh jenkins "curl -s -X POST http://localhost:8090/job/propops-webapp-pipeline/build"
```
