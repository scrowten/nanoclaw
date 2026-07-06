---
name: engineering-agent
description: Engineering SDLC tools — Jira, Bitbucket, and Confluence integration via REST APIs. Use for managing tickets, branches, PRs, and reading deployment docs.
---

# Engineering Agent Tools

This skill provides API references for the engineering workflow. All API calls use `curl` with credentials injected by OneCLI.

## Jira

Read `/home/node/.claude/skills/engineering-agent/jira.md` for the full API reference.

Quick reference:
```bash
# Get issue details
curl -s -H "Authorization: Basic $JIRA_AUTH" \
  "https://redawning.atlassian.net/rest/api/3/issue/PROP-123"

# Transition issue (move status)
curl -s -X POST -H "Authorization: Basic $JIRA_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"transition": {"id": "<transition-id>"}}' \
  "https://redawning.atlassian.net/rest/api/3/issue/PROP-123/transitions"
```

## Bitbucket

Read `/home/node/.claude/skills/engineering-agent/bitbucket.md` for the full API reference.

Quick reference:
```bash
# Create pull request
curl -s -X POST -H "Authorization: Basic $BB_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"title": "PROP-123: Fix widget", "source": {"branch": {"name": "feature/PROP-123-fix-widget"}}, "destination": {"branch": {"name": "master"}}}' \
  "https://api.bitbucket.org/2.0/repositories/<workspace>/propops-webapp/pullrequests"
```

## Confluence

Read `/home/node/.claude/skills/engineering-agent/confluence.md` for the full API reference.

Quick reference:
```bash
# Search for deployment docs
curl -s -H "Authorization: Basic $JIRA_AUTH" \
  "https://redawning.atlassian.net/wiki/rest/api/content?title=Development+Deployment+Workflow&spaceKey=PO"
```
