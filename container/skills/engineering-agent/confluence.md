# Confluence REST API Reference

Base URL: `https://redawning.atlassian.net/wiki/rest/api`
Auth header: `Authorization: Basic $JIRA_AUTH` (same Atlassian token as Jira)

## Search Pages by Title

```bash
curl -s -H "Authorization: Basic $JIRA_AUTH" \
  "https://redawning.atlassian.net/wiki/rest/api/content?title=Development+Deployment+Workflow&spaceKey=PO" | jq '.results[] | {id, title}'
```

## Read Page Content

```bash
curl -s -H "Authorization: Basic $JIRA_AUTH" \
  "https://redawning.atlassian.net/wiki/rest/api/content/<page-id>?expand=body.storage" | jq '.body.storage.value'
```

## Search by CQL (Confluence Query Language)

```bash
curl -s -H "Authorization: Basic $JIRA_AUTH" \
  --data-urlencode "cql=space=PO AND type=page AND text~'deployment'" \
  "https://redawning.atlassian.net/wiki/rest/api/content/search" | jq '.results[] | {id, title}'
```

## Key Pages

- Development & Deployment Workflow: space PO, search for "Development Deployment Workflow"
  Direct URL: https://redawning.atlassian.net/wiki/spaces/PO/pages/3230760962/Development+Deployment+Workflow
