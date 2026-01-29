# Security Architecture

## API Key Protection

**Redaction:** `sanitizeError()` in `bot.ts` strips any string matching `sk-*` from error messages before they reach logs or PR comments.

**Storage:** API keys are expected to be stored as GitHub repository secrets (encrypted at rest, never exposed in logs, only accessible to workflow runs).

**Loading:** Keys are loaded from environment variables first, then from GitHub repo variables as a fallback. They are never embedded in code or config files.

## Access Control

### Maintainer-Only Reviews

The `/gpt-review` command is restricted by default on public repositories to prevent non-maintainers from consuming the repo owner's OpenAI API quota.

**Permission check flow:**
1. `shouldRequireMaintainer()` determines if restriction applies (public repos by default, overridable via `REQUIRE_MAINTAINER_REVIEW`)
2. `checkUserPermission()` calls GitHub's collaborator permission endpoint
3. Permissions considered "maintainer": `admin`, `maintain`, `write`

**Private repos:** No restriction by default (anyone with repo access can trigger reviews).

### Reviewer Authorization

`review-analyzer.ts` includes server-side authorization verification for quality scoring:

- Calls GitHub's `/repos/{owner}/{repo}/collaborators/{username}/permission` endpoint
- Results cached in an LRU cache (5-minute TTL, max 1,000 entries)
- Fail-secure: any error returns `isVerified: false`
- Tokens are never included in `ReviewerAuth` objects

## Input Validation

`analyzeReviewSeverity()` enforces limits to prevent abuse:
- Maximum 10,000 characters per review text
- Maximum 1,000 lines per review
- Issue deduplication to prevent score gaming via fragmented input

## Quality Score Integrity

The `calculateQualityScore()` function requires a verified `ReviewerAuth` to apply LGTM bonuses or penalties. Without server-verified authorization, LGTM status is ignored in scoring, preventing spoofed approvals from inflating scores.
