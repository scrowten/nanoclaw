# Code Review Template

Review the diff on the current feature branch against `master`. Produce a structured findings report.

## Generate the diff

```bash
cd /workspace/extra/<repo>
git diff master...HEAD
```

Also check for any untracked files that should be committed:
```bash
git status
```

## Review Checklist

### Correctness
- Does the code implement the requirements from the Jira ticket?
- Are edge cases handled (nulls, empty arrays, missing fields, boundary values)?
- Are there off-by-one errors, race conditions, or incorrect type coercions?
- Do database queries return the expected shape and handle zero results?

### Security
- No hardcoded secrets, API keys, or credentials
- User input is validated and sanitized before use
- SQL queries use parameterized statements (no string concatenation)
- No XSS vectors in templates or rendered HTML
- Authentication/authorization checks are present where needed
- Error messages do not leak internal details (stack traces, DB schema, file paths)

### Performance
- No N+1 query patterns (queries inside loops)
- Large datasets use pagination or streaming
- Expensive operations are not repeated unnecessarily
- Database queries have appropriate indexes (check existing migrations)

### Test Coverage
- New functionality has corresponding test cases
- Tests cover the happy path AND at least one error/edge case
- Tests are isolated (no shared mutable state between tests)
- Mocks are reasonable and don't mask real behavior

### Code Style
- Follows existing patterns in the codebase
- Functions are focused and reasonably sized (<50 lines)
- Variable and function names are descriptive
- No dead code, commented-out blocks, or TODO items without a ticket reference

### Compatibility
- No breaking changes to existing APIs or interfaces without migration
- Database migrations are backwards-compatible (can roll back)
- Config changes have defaults for existing deployments

## Severity Levels

| Level | Definition | Action |
|-------|-----------|--------|
| CRITICAL | Data loss, security vulnerability, or crashes in production | Must fix before merge |
| HIGH | Incorrect behavior, missing validation, or test gaps for core logic | Must fix before merge |
| MEDIUM | Code style, minor performance, or missing edge-case tests | Should fix, can defer |
| LOW | Naming, formatting, documentation, or minor improvements | Optional |

## Output Format

```
## Code Review: <JIRA-KEY>

Branch: feature/<JIRA-KEY>-<desc>
Files changed: <N>
Lines added/removed: +<N> / -<N>

### CRITICAL (<count>)
- <file>:<line> — <description>
  Fix: <suggested fix>

### HIGH (<count>)
- <file>:<line> — <description>
  Fix: <suggested fix>

### MEDIUM (<count>)
- <file>:<line> — <description>

### LOW (<count>)
- <file>:<line> — <description>

### Summary
<1-2 sentence overall assessment>
Verdict: PASS / FAIL (FAIL if any CRITICAL or HIGH remain)
```
