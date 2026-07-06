---
name: engineering-agent
description: Engineering SDLC tools — Jira, Bitbucket, and Confluence integration via REST APIs. Use for managing tickets, branches, PRs, and reading deployment docs.
---

# Engineering Agent Tools

This skill provides API references for the engineering workflow. All API calls use `curl` — OneCLI's HTTPS proxy automatically injects auth headers based on the request host. Do NOT add Authorization headers manually.

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
