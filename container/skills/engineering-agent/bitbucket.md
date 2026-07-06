# Bitbucket REST API Reference

Base URL: `https://api.bitbucket.org/2.0`
Auth header: `Authorization: Basic $BB_AUTH` (injected by OneCLI)
Workspace: `redawning` (confirm actual workspace slug)
Repo slug: `propops-webapp`

## Create Pull Request

```bash
curl -s -X POST -H "Authorization: Basic $BB_AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "PROP-123: Short description",
    "description": "## Summary\n- Implemented feature X\n- Added tests\n\n## Jira\nhttps://redawning.atlassian.net/browse/PROP-123\n\n## Test Evidence\n- All tests pass\n- Manually verified on staging",
    "source": {
      "branch": {"name": "feature/PROP-123-short-desc"}
    },
    "destination": {
      "branch": {"name": "master"}
    },
    "close_source_branch": true
  }' \
  "https://api.bitbucket.org/2.0/repositories/<workspace>/propops-webapp/pullrequests" | jq .
```

## Get Pull Request

```bash
curl -s -H "Authorization: Basic $BB_AUTH" \
  "https://api.bitbucket.org/2.0/repositories/<workspace>/propops-webapp/pullrequests/<pr-id>" | jq .
```

## List Open Pull Requests

```bash
curl -s -H "Authorization: Basic $BB_AUTH" \
  "https://api.bitbucket.org/2.0/repositories/<workspace>/propops-webapp/pullrequests?state=OPEN" | jq '.values[] | {id, title, state}'
```

## Merge Pull Request

```bash
curl -s -X POST -H "Authorization: Basic $BB_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"merge_strategy": "squash"}' \
  "https://api.bitbucket.org/2.0/repositories/<workspace>/propops-webapp/pullrequests/<pr-id>/merge" | jq .
```

## Get Pipeline Status

```bash
curl -s -H "Authorization: Basic $BB_AUTH" \
  "https://api.bitbucket.org/2.0/repositories/<workspace>/propops-webapp/pipelines/?sort=-created_on&pagelen=5" | jq '.values[] | {uuid, state, created_on}'
```

## Add PR Comment

```bash
curl -s -X POST -H "Authorization: Basic $BB_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"content": {"raw": "Code review passed. Ready to merge."}}' \
  "https://api.bitbucket.org/2.0/repositories/<workspace>/propops-webapp/pullrequests/<pr-id>/comments"
```

## Git Push (via CLI)

```bash
cd /workspace/extra/propops-webapp
git config user.email "engineering-bot@redawning.com"
git config user.name "Engineering Agent"
git push origin feature/<JIRA-KEY>-<short-desc>
```

Note: Git credentials for Bitbucket should be configured via `.netrc` or credential helper. OneCLI may inject these automatically.
