# Jira REST API Reference

Base URL: `https://redawning.atlassian.net/rest/api/3`
Auth: Injected automatically by OneCLI proxy (host pattern: `*.atlassian.net`). Do NOT add Authorization headers manually.

## Get Issue

```bash
curl -s "https://redawning.atlassian.net/rest/api/3/issue/PROP-123" | jq .
```

## Search Issues (JQL)

```bash
curl -s --data-urlencode "jql=project=PROP AND status='To Do'" \
  "https://redawning.atlassian.net/rest/api/3/search" | jq .
```

## Create Issue

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "project": {"key": "PROP"},
      "summary": "Implement feature X",
      "description": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Description here"}]}]},
      "issuetype": {"name": "Task"}
    }
  }' \
  "https://redawning.atlassian.net/rest/api/3/issue" | jq .
```

## Create Subtask

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "project": {"key": "PROP"},
      "parent": {"key": "PROP-123"},
      "summary": "Subtask description",
      "issuetype": {"name": "Sub-task"}
    }
  }' \
  "https://redawning.atlassian.net/rest/api/3/issue" | jq .
```

## Update Issue

```bash
curl -s -X PUT -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "summary": "Updated title",
      "labels": ["engineering-agent", "automated"]
    }
  }' \
  "https://redawning.atlassian.net/rest/api/3/issue/PROP-123"
```

## Add Comment

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{
    "body": {
      "type": "doc",
      "version": 1,
      "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Requirements approved. Starting development."}]}]
    }
  }' \
  "https://redawning.atlassian.net/rest/api/3/issue/PROP-123/comment"
```

## Get Available Transitions

```bash
curl -s "https://redawning.atlassian.net/rest/api/3/issue/PROP-123/transitions" | jq '.transitions[] | {id, name}'
```

## Transition Issue (Move Status)

First get available transitions (above), then execute:

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"transition": {"id": "<transition-id>"}}' \
  "https://redawning.atlassian.net/rest/api/3/issue/PROP-123/transitions"
```

Common transitions (IDs vary by project — always query first):
- To Do → In Progress
- In Progress → In Review
- In Review → Done
