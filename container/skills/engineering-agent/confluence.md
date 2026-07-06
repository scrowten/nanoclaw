# Confluence REST API Reference

Base URL: `https://redawning.atlassian.net/wiki/rest/api`
Auth: Injected automatically by OneCLI proxy (same `*.atlassian.net` host pattern as Jira). Do NOT add Authorization headers manually.

## Search Pages by Title

```bash
curl -s "https://redawning.atlassian.net/wiki/rest/api/content?title=Development+Deployment+Workflow&spaceKey=PO" | jq '.results[] | {id, title}'
```

## Read Page Content

```bash
curl -s "https://redawning.atlassian.net/wiki/rest/api/content/<page-id>?expand=body.storage" | jq '.body.storage.value'
```

## Search by CQL (Confluence Query Language)

```bash
curl -s --data-urlencode "cql=space=PO AND type=page AND text~'deployment'" \
  "https://redawning.atlassian.net/wiki/rest/api/content/search" | jq '.results[] | {id, title}'
```

## Key Pages

- Development & Deployment Workflow: space PO, search for "Development Deployment Workflow"
  Direct URL: https://redawning.atlassian.net/wiki/spaces/PO/pages/3230760962/Development+Deployment+Workflow
