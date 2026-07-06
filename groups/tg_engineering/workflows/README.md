# Workflow State Files

Each active engineering request is tracked as a JSON file: `<JIRA-KEY>.json`

## Schema

```json
{
  "jiraKey": "PROP-123",
  "title": "Short description of the request",
  "status": "intake|analysis|awaiting_approval|development|review|pr|done",
  "targetRepo": "propops-webapp|airflow",
  "branch": "feature/PROP-123-short-desc",
  "requirements": [
    "Requirement 1 — acceptance criteria",
    "Requirement 2 — acceptance criteria"
  ],
  "approvals": [
    { "step": "requirements", "approved_by": "Rizky", "at": "2026-07-06T12:30:00Z" }
  ],
  "commits": [
    { "hash": "abc1234", "message": "feat(widget): add validation", "at": "2026-07-06T13:00:00Z" }
  ],
  "review_findings": [],
  "pr_url": "https://bitbucket.org/...",
  "created_at": "2026-07-06T12:00:00Z",
  "updated_at": "2026-07-06T14:00:00Z"
}
```

## Status Values

| Status | Description |
|--------|-------------|
| `intake` | Receiving and clarifying the request |
| `analysis` | Generating structured requirements |
| `awaiting_approval` | Requirements posted, waiting for human approval |
| `development` | Implementing the approved requirements |
| `review` | Code review in progress |
| `pr` | PR created, awaiting merge |
| `done` | PR merged, Jira updated |
