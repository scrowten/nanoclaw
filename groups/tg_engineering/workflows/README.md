# Workflow State Files

Each active engineering request is tracked as a JSON file: `<JIRA-KEY>.json`

## Schema

```json
{
  "jiraKey": "PROP-123",
  "title": "Short description of the request",
  "status": "intake|analysis|awaiting_approval|development|review|pr|staging|deploy|done",
  "targetRepo": "propops-webapp|airflow",
  "branch": "feature/PROP-123-short-desc",
  "requirements": [
    "Requirement 1 — acceptance criteria",
    "Requirement 2 — acceptance criteria"
  ],
  "approvals": [
    { "step": "requirements", "approved_by": "Rizky", "at": "2026-07-06T12:30:00Z" },
    { "step": "staging", "approved_by": "Rizky", "at": "2026-07-06T15:00:00Z" },
    { "step": "production", "approved_by": "Rizky", "at": "2026-07-06T16:00:00Z" }
  ],
  "commits": [
    { "hash": "abc1234", "message": "feat(widget): add validation", "at": "2026-07-06T13:00:00Z" }
  ],
  "review_findings": [],
  "pr_url": "https://bitbucket.org/...",
  "deploy": {
    "staging": {
      "deployed_at": "2026-07-06T15:00:00Z",
      "method": "ssh",
      "status": "success",
      "verified": true
    },
    "production": {
      "deployed_at": "2026-07-06T16:00:00Z",
      "method": "jenkins",
      "jenkins_build": 42,
      "status": "success",
      "rollback_build": null
    }
  },
  "created_at": "2026-07-06T12:00:00Z",
  "updated_at": "2026-07-06T16:00:00Z"
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
| `staging` | Deploying to staging, verifying, waiting for approval |
| `deploy` | Deploying to production via Jenkins |
| `done` | Production deployed, Jira updated to Done |
