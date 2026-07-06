# Engineering Agent — Implementation Plan

> End-to-end Engineering Agent that autonomously handles the full software development lifecycle (intake → merge) with human-in-the-loop approval gates via Google Chat.

## Context

- **Nanoclaw repo (upstream):** https://github.com/nanocoai/nanoclaw
- **Local fork:** /home/rizkyagung/self/nanoclaw
- **Target repos:** propops-webapp and airflow (Bitbucket, RedAwning org)
- **Prior work:** Telegram bots in nanoclaw (reference for channel/agent patterns)

## Architecture

```
Google Chat Space
       │
       ▼
[Google Chat Channel]          ← New: src/channels/gchat.ts (self-registers)
       │
       ▼
[SQLite message store]         ← Existing infrastructure
       │
       ▼
[Orchestrator / polling loop]  ← Existing: src/index.ts
       │
       ▼
[Container: engineering-agent] ← Group with additionalMounts (propops-webapp, airflow)
       │
       ▼
[CLAUDE.md: workflow engine]   ← groups/gchat_engineering/CLAUDE.md (state machine)
       │
       ▼
[Container Skills]             ← container/skills/engineering-agent/ (Jira, Bitbucket, Confluence)
```

### Key Design Decisions

1. **Google Chat as a NanoClaw channel** (like Telegram). Self-registers, converts messages to NanoClaw's `NewMessage` format, stores in SQLite. Orchestrator polls and routes normally.
2. **Single group** (`gchat_engineering`) with `requiresTrigger: false`, `containerConfig.additionalMounts` for propops-webapp and airflow repos (read-write).
3. **Workflow state via filesystem**. Each active ticket gets a `workflows/<JIRA-KEY>.json` file in the group directory.
4. **Approval gates are conversational**. Agent posts "Awaiting approval" and only proceeds on explicit approval keywords.
5. **Sub-agents for code review**. Engineering agent spawns a reviewer sub-agent via TeamCreate.
6. **Git operations inside container**. Repos mounted read-write; OneCLI injects Bitbucket credentials.

## Workflow State Machine

```
INTAKE → ANALYSIS          : Request understood (all questions answered)
ANALYSIS → AWAITING_APPROVAL : Requirements posted to Jira + Google Chat
AWAITING_APPROVAL → DEVELOPMENT : Explicit approval received
DEVELOPMENT → STAGING     : Implementation complete + tests pass (optional)
DEVELOPMENT → REVIEW      : Implementation complete (skip staging)
STAGING → REVIEW           : Staging validation passes
REVIEW → DEVELOPMENT       : Code review finds blocking issues
REVIEW → PR                : Code review is clean
PR → DONE                  : PR merged and Jira updated
```

## Pre-Work: Upstream Sync

**Recommendation: Do NOT sync with upstream before starting.**

Rationale: Fork is stable, this feature uses well-established patterns (channel + container), syncing mid-feature risks merge conflicts. Sync after via `/update-nanoclaw`.

---

## Phase 1: Google Chat Channel (~3-4 days)

| Step | File | Description |
|------|------|-------------|
| 1.1 | `src/channels/gchat.ts` | Implement `GoogleChatChannel` class (service account auth, poll/push messages, thread support). Follow `src/channels/telegram.ts` pattern: self-register via `registerChannel('gchat', factory)`, implement `connect()`, `sendMessage()`, `ownsJid()`, `isConnected()`, `disconnect()`, `setTyping()`. JID format: `gchat:<space-id>` |
| 1.2 | `src/channels/index.ts` | Add `import './gchat.js';` |
| 1.3 | `package.json` | Add `googleapis` dependency |
| 1.4 | `.claude/skills/add-gchat/SKILL.md` | Setup guide: Google Cloud project, Chat API, service account, space ID, group registration |
| 1.5 | `src/channels/gchat.test.ts` | Unit tests: message parsing, JID ownership, send formatting, credential loading, thread ID mapping |

## Phase 2: Engineering Agent Group (~1 day)

| Step | File | Description |
|------|------|-------------|
| 2.1 | Group registration | Register `gchat_engineering` group with `additionalMounts` for propops-webapp + airflow |
| 2.2 | Mount allowlist | Add project dirs to `~/.config/nanoclaw/mount-allowlist.json` |
| 2.3 | `groups/gchat_engineering/CLAUDE.md` | Full SDLC workflow instructions, state machine, approval gates, formatting rules |
| 2.4 | `groups/gchat_engineering/workflows/` | Define JSON schema for per-ticket workflow state |

### Workflow State Schema

```json
{
  "jiraKey": "PROP-123",
  "title": "...",
  "status": "intake|analysis|awaiting_approval|development|staging|review|pr|done",
  "thread_id": "gchat-thread-id",
  "branch": "feature/PROP-123-short-desc",
  "targetRepo": "propops-webapp|airflow",
  "requirements": [],
  "approvals": [{ "step": "...", "approved_by": "...", "at": "..." }],
  "commits": [],
  "pr_url": "...",
  "created_at": "...",
  "updated_at": "..."
}
```

## Phase 3: Container Skills (~2 days)

| Step | File | Description |
|------|------|-------------|
| 3.1 | `container/skills/engineering-agent/jira.md` | Jira REST API: search issues, get details, create issues/subtasks, update issues, **transition status** (`POST /rest/api/3/issue/{key}/transitions`), add comments |
| 3.2 | `container/skills/engineering-agent/bitbucket.md` | Bitbucket API: push branches, create PRs, get PR status, merge PRs, get pipeline status |
| 3.3 | `container/skills/engineering-agent/confluence.md` | Confluence API: search pages, read page content (deployment workflow docs) |
| 3.4 | `container/skills/engineering-agent/SKILL.md` | Combined skill entry point referencing all above |

### Jira Transitions (Detail)

The agent will transition tickets through the workflow:
- **To Do → In Progress**: When development starts
- **In Progress → Code Review**: When implementation complete
- **Code Review → Done**: When PR merged

```bash
# Get available transitions
curl -s -H "Authorization: Basic $JIRA_AUTH" \
  "$JIRA_BASE_URL/rest/api/3/issue/PROP-123/transitions"

# Execute transition
curl -s -X POST -H "Authorization: Basic $JIRA_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"transition": {"id": "<transition-id>"}}' \
  "$JIRA_BASE_URL/rest/api/3/issue/PROP-123/transitions"
```

## Phase 4: Workflow Engine (~2-3 days)

| Step | File | Description |
|------|------|-------------|
| 4.1 | CLAUDE.md | State machine transitions with entry/exit criteria |
| 4.2 | CLAUDE.md | Approval gate logic (keywords, blocking behavior, NEVER proceed without explicit approval) |
| 4.3 | `groups/gchat_engineering/code-review-template.md` | Code review sub-agent prompt template |

### Approval Gate Keywords

```
APPROVE: "approved", "go ahead", "proceed", "lgtm", "ship it", "yes"
REJECT:  "no", "hold", "stop", "wait", "changes needed", "modify"
```

## Phase 5: Credential Configuration (~1 day)

| Step | What |
|------|------|
| 5.1 | OneCLI: Atlassian API token → `*.atlassian.net` (Jira + Confluence) |
| 5.2 | OneCLI: Bitbucket app password → `api.bitbucket.org` |
| 5.3 | Google Chat service account on host (channel runs on host, not container) |
| 5.4 | Git identity in container: `engineering-bot@redawning.com` |

## Phase 6: Integration Testing (~2-3 days)

| Step | What |
|------|------|
| 6.1 | E2E: intake → clarification → Jira ticket → approval gate (verify halt) |
| 6.2 | E2E: development → branch → commit → PR → Jira transition to Done |
| 6.3 | Error recovery: crash mid-workflow, resume from state file |
| 6.4 | Timeout handling: 24h reminder, 48h stalled notification |

## Phase 7: Polish (~1-2 days)

| Step | What |
|------|------|
| 7.1 | Google Chat formatting (bold, code, links, cards) |
| 7.2 | `/add-engineering-agent` comprehensive setup skill |
| 7.3 | Status/monitoring JSON for main channel visibility |

---

## File Manifest

### New Files

| Path | Type | Purpose |
|------|------|---------|
| `src/channels/gchat.ts` | Channel | Google Chat API integration |
| `src/channels/gchat.test.ts` | Test | Channel unit tests |
| `groups/gchat_engineering/CLAUDE.md` | Group memory | Workflow engine instructions |
| `groups/gchat_engineering/code-review-template.md` | Template | Sub-agent prompt |
| `groups/gchat_engineering/workflows/README.md` | Schema | Workflow state format |
| `container/skills/engineering-agent/SKILL.md` | Skill | Combined tool skill |
| `container/skills/engineering-agent/jira.md` | Reference | Jira API (incl. transitions) |
| `container/skills/engineering-agent/bitbucket.md` | Reference | Bitbucket API |
| `container/skills/engineering-agent/confluence.md` | Reference | Confluence API |
| `.claude/skills/add-gchat/SKILL.md` | Skill | Channel setup guide |
| `.claude/skills/add-engineering-agent/SKILL.md` | Skill | Full agent setup guide |

### Modified Files

| Path | Change |
|------|--------|
| `src/channels/index.ts` | Add `import './gchat.js';` |
| `package.json` | Add `googleapis` dependency |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Agent proceeds without approval | HIGH | Multiple CLAUDE.md reinforcement patterns; explicit "STOP AND WAIT" instructions; extensive testing |
| Google Chat bidirectional auth complexity | MEDIUM | Service account with Chat API scope; documented in setup skill |
| Git merge conflicts in target repos | MEDIUM | Agent instructions include conflict resolution + human escalation |
| Container timeout on long dev sessions | MEDIUM | Extended timeout config (30+ min) for engineering group |
| Workflow state corruption on crash | LOW | Atomic JSON writes (write-tmp-rename) |

---

## Integrations & Access Required

### Google Chat API
- Service account with `chat.bot` scope
- Bot registered in Google Cloud Console
- Deployed to a Chat space
- Env: `GOOGLE_CHAT_SERVICE_ACCOUNT_KEY`, `GOOGLE_CHAT_SPACE_ID`

### Jira (Atlassian) API
- Atlassian API token
- Env: `JIRA_BASE_URL=https://redawning.atlassian.net`, `JIRA_USER_EMAIL`, `JIRA_API_TOKEN`
- Permissions: Project write (create/update issues, transitions, comments)

### Confluence API
- Same Atlassian token as Jira
- Env: `CONFLUENCE_BASE_URL=https://redawning.atlassian.net/wiki`

### Bitbucket API
- App password with `repository:write` + `pullrequest:write`
- Env: `BITBUCKET_USERNAME`, `BITBUCKET_APP_PASSWORD`, `BITBUCKET_WORKSPACE`, `BITBUCKET_REPO_SLUG`

### Airflow (Database Queries)
- Docker exec access or Airflow REST API
- For data investigation during analysis phase

### Local Filesystem
- `/home/rizkyagung/self/nanoclaw`
- `/home/rizkyagung/mindo/projects/src/propops-webapp`
- `/home/rizkyagung/mindo/projects/src/propops-webapp/airflow`

---

## Timeline

| Phase | Effort | Calendar |
|-------|--------|----------|
| Phase 1: Google Chat Channel | 3-4 days | Week 1 |
| Phase 2: Group Setup | 1 day | Week 1 |
| Phase 3: Container Skills | 2 days | Week 2 |
| Phase 4: Workflow Engine | 2-3 days | Week 2 |
| Phase 5: Credentials | 1 day | Week 2 |
| Phase 6: Integration Testing | 2-3 days | Week 3 |
| Phase 7: Polish | 1-2 days | Week 3 |
| **Total** | **12-16 days** | **~3 weeks** |

---

## Key References

| File | Why |
|------|-----|
| `src/channels/telegram.ts` | Primary reference for Google Chat channel implementation |
| `src/channels/registry.ts` | Channel registration mechanism |
| `src/types.ts` | `Channel` interface, `NewMessage` type, `RegisteredGroup` |
| `src/container-runner.ts` | `additionalMounts` validation and volume mount building |
| `container/agent-runner/src/index.ts` | Agent runtime, IPC, sessions |
| `container/skills/capabilities/SKILL.md` | Example container skill format |
| `.claude/skills/x-integration/SKILL.md` | Complex integration skill reference |
| `groups/telegram_main/CLAUDE.md` | Comprehensive CLAUDE.md with workflows |
