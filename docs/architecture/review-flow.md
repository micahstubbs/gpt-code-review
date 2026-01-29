# Review Flow

This document traces a code review from GitHub event to posted comment.

## Trigger Points

Reviews are triggered two ways:

1. **Automatic** -- A PR is opened or new commits are pushed (`pull_request.opened`, `pull_request.synchronize`). Controlled by `AUTO_REVIEW` env var (default: `true`). Optionally filtered by `TARGET_LABEL`.

2. **On-demand** -- A user comments `/gpt-review` on a PR (`issue_comment.created`). Supports an optional model argument: `/gpt-review gpt-5.2-pro-2025-12-11`. Access controlled by `REQUIRE_MAINTAINER_REVIEW` (default: maintainers only on public repos).

## Step-by-Step Flow

### 1. Event Reception

```
GitHub webhook → Adapter (Actions/Lambda/Probot) → bot.ts event handler
```

For on-demand reviews, the bot first:
- Verifies the comment is on a PR (not a plain issue)
- Checks user permission via GitHub collaborator API
- Adds an `eyes` reaction to acknowledge the command
- Parses optional model argument

### 2. API Key Loading

The bot loads the OpenAI API key from (in order):
1. `OPENAI_API_KEY` environment variable
2. GitHub repository variable named `OPENAI_API_KEY` (via `actions/getRepoVariable`)

If neither exists, it posts an error comment to the PR.

### 3. File Filtering

```
repos.compareCommits(base, head)
    │
    ▼
All changed files
    │
    ├─ INCLUDE_PATTERNS set? → only keep matching files
    │  else → remove files matching IGNORE_PATTERNS
    │
    ├─ Remove non-modified/added files (skip deletions, renames)
    │
    └─ Remove files where patch.length > MAX_PATCH_LENGTH
```

Pattern matching uses `minimatch` for glob patterns, falling back to regex if the glob fails. Both absolute paths (`/node_modules`) and relative patterns (`*.md`) are supported.

### 4. Per-File Review

For each surviving file, `chat.codeReview(patch)` is called with the git diff. The Chat class routes to one of three API paths based on model type (see [openai-integration.md](openai-integration.md)).

### 5. Batch Posting

Reviews are posted incrementally to guard against GitHub App token expiration (1 hour limit):

| Trigger | Condition |
|---------|-----------|
| File count | Every 20 files reviewed |
| Elapsed time | Every 30 minutes |
| Completion | All files processed |

At 40 minutes elapsed, a warning is logged about potential token expiration.

Each batch is posted via `pulls.createReview()` with:
- `event: 'COMMENT'`
- Array of `comments` with `{ path, position, body }`
- Position is always `1` (comment on first line of diff)

### 6. LGTM Handling

If no files produce review comments, the bot posts a single LGTM comment on the PR instead of a review.

## Error Handling

OpenAI API errors are caught and translated to user-friendly messages:

| Error | User Message |
|-------|-------------|
| 429 (rate limit) | Rate limited, try again later |
| 401 (auth) | Invalid API key |
| 403 (quota) | Quota exceeded |
| Other | Sanitized error (API keys redacted) |

Errors are posted as PR comments so the user sees feedback even when the review fails.
