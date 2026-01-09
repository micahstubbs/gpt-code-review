# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChatGPT-CodeReview is a GitHub bot powered by OpenAI models (GPT-4o, GPT-5.1, etc.) that automatically reviews code in Pull Requests. Built on the Probot framework, it can be deployed as a GitHub App, GitHub Action, or self-hosted service on AWS Lambda/Vercel.

## Build and Development Commands

### Install dependencies

```bash
yarn install
```

### Build the project

```bash
yarn build
```

This builds three targets:

- `dist/` - Main Probot bot (ES modules)
- `action/` - GitHub Action bundle (compiled with @vercel/ncc)
- `lambda/` - AWS Lambda bundle (use `yarn build:lambda`)

### Run tests

```bash
yarn test
```

Tests use Jest with ts-jest. Test files: `test/*.test.ts`

### Run the bot locally

```bash
yarn start
```

Requires `.env` file with configuration (see `.env.example`)

## Code Architecture

### Entry Points

- **`src/index.ts`** - Probot app entry point
- **`src/github-action.cjs`** - GitHub Actions adapter (CommonJS)
- **`src/aws-lambda.cjs`** - AWS Lambda serverless adapter (CommonJS)
- **`middleware.ts`** - Edge middleware for Vercel deployment

### Core Components

- **`src/bot.ts`** - Main bot logic
  - Handles `pull_request.opened` and `pull_request.synchronize` events
  - Loads OpenAI API key from environment or GitHub repo variables
  - Filters changed files by patterns (`IGNORE_PATTERNS`, `INCLUDE_PATTERNS`)
  - Calls `Chat.codeReview()` for each modified/added file
  - Posts review comments via GitHub API

- **`src/chat.ts`** - OpenAI integration
  - Supports OpenAI, Azure OpenAI, and GitHub Models
  - **IMPORTANT**: Uses dual API approach:
    - **Responses API** for GPT-5.1+ models (`/v1/responses`)
    - **Chat Completions API** for GPT-4o and earlier models (`/v1/chat/completions`)
  - Returns structured JSON: `{ lgtm: boolean, review_comment: string }`

- **`src/log.ts`** - Logging configuration (loglevel)

### Build Configuration

- **`rollup.config.ts`** - Rollup build for ES modules
  - Compiles TypeScript to ES modules in `dist/`
  - Uses esbuild plugin for fast compilation

- **`jest.config.js`** - Test configuration
  - Roots: `src/`, `test/`
  - Transform: `ts-jest` for TypeScript

- **`tsconfig.json`** - TypeScript configuration
  - Target: ESNext
  - Module: NodeNext
  - Strict mode enabled
  - Output: `lib/` (type declarations)

## Model Support

### Responses API Models (GPT-5.2+, GPT-5.1+) - Recommended

- `gpt-5.2-2025-12-11` - **Default model**, excellent balance of quality and cost
- `gpt-5.2-pro-2025-12-11` - Premium tier for complex reviews (no structured outputs - uses JSON extraction)
- `gpt-5.1-codex` - Optimized for code review
- `gpt-5.1-codex-mini` - Cost-effective variant
- `gpt-5.1` - Enhanced reasoning model

### Chat Completions API Models (Legacy)

- `gpt-4o`, `gpt-4o-mini`
- `gpt-3.5-turbo`

**Key Difference**: GPT-5.1+ models use `src/chat.ts:codeReviewWithResponsesAPI()` which supports:

- Chain of thought (CoT) passing
- Reasoning effort control (`REASONING_EFFORT`: none/minimal/low/medium/high)
- Structured output schema (GPT-5.2-Pro uses JSON extraction fallback)

## Environment Variables

### Required

- `OPENAI_API_KEY` - OpenAI API key (or set in GitHub repo variables)
- `APP_ID` - GitHub App ID (for self-hosted bot)
- `PRIVATE_KEY` - GitHub App private key (for self-hosted bot)

### Optional

- `MODEL` - Model name (default: `gpt-5.2-2025-12-11`)
- `LANGUAGE` - Review language (e.g., "Chinese", "English")
- `PROMPT` - Custom review prompt
- `temperature` - Sampling temperature (Chat Completions only)
- `top_p` - Nucleus sampling (Chat Completions only)
- `max_tokens` - Max response tokens (Chat Completions only)
- `REASONING_EFFORT` - Reasoning effort for GPT-5.1+ (none/minimal/low/medium/high)
- `VERBOSITY` - Response verbosity for GPT-5.1+ (low/medium/high)
- `MAX_PATCH_LENGTH` - Skip files with diffs larger than this
- `IGNORE_PATTERNS` - Comma-separated glob/regex patterns to ignore
- `INCLUDE_PATTERNS` - Comma-separated glob/regex patterns to include
- `TARGET_LABEL` - Only review PRs with this label

### Azure OpenAI

- `AZURE_API_VERSION`
- `AZURE_DEPLOYMENT`
- `OPENAI_API_ENDPOINT`

### GitHub Models

- `USE_GITHUB_MODELS=true`
- `GITHUB_TOKEN`

## Deployment Targets

### 1. GitHub App (Self-hosted)

```bash
yarn build
pm2 start pm2.config.cjs
```

### 2. GitHub Actions

Use marketplace action: `anc95/ChatGPT-CodeReview@main`

Workflow file: `.github/workflows/cr.yml`

### 3. AWS Lambda

```bash
yarn build:lambda
# Deploy lambda/ directory to AWS Lambda
```

### 4. Vercel Edge

Deploy `middleware.ts` to Vercel edge functions

## File Filtering Logic

Files are processed in this order:

1. Extract changed files from PR diff
2. If `INCLUDE_PATTERNS` is set, only process matching files
3. Otherwise, exclude files matching `IGNORE_PATTERNS`
4. Skip files with `status !== 'modified' && status !== 'added'`
5. Skip files where `patch.length > MAX_PATCH_LENGTH`

Pattern matching supports:

- Glob patterns (via `minimatch`)
- Regex patterns (fallback if glob fails)
- Both absolute paths (`/node_modules`) and relative patterns (`*.md`)

## Code Review Flow

1. PR opened/synchronized
2. Load OpenAI API key (env or GitHub repo variable)
3. Check PR state (not closed/locked) and optional label
4. Compare commits to get changed files
5. Filter files by patterns
6. For each file:
   - Call `Chat.codeReview(patch)` with git diff
   - Collect review comments
7. Post review via GitHub API with all comments

## Testing

Run all tests:

```bash
yarn test
```

Test fixtures are in `test/fixtures/`

## Git Workflow

### Branch Naming Convention

All feature and fix branches must follow this naming format:

```
<gh-issue-number>/description-of-change
```

**Examples:**

- `30/phase1-critical-security-fixes` - Implementation for issue #30
- `25/fix-404-authorization-bug` - Fix for issue #25
- `14/implement-lgtm-authorization` - Feature for issue #14

**Rules:**

- Always create a GitHub issue first
- Use the issue number as the branch prefix
- Use lowercase with hyphens for description
- Keep description concise but descriptive

### Planning and Documentation

When working on significant features or fixes:

1. Create a GitHub issue for the work
2. Create design/planning documents in `issues/<issue-number>/` directory
3. Checkout branch using the naming convention above
4. Implement changes following the design
5. Create PR when complete
6. Open the PR in the user's default browser

### Changelog and Releases

**IMPORTANT:** Always update `CHANGELOG.md` before creating a release or tag.

1. Add a new version section following [Keep a Changelog](https://keepachangelog.com/) format
2. Document all notable changes under appropriate categories:
   - **Added** - New features
   - **Changed** - Changes to existing functionality
   - **Fixed** - Bug fixes
   - **Removed** - Removed features
   - **Security** - Security-related changes
3. Include issue/PR references where applicable (e.g., `(#66)`)
4. Commit the changelog update before tagging the release
5. Update both the version tag (e.g., `v3.1.0`) and floating major tag (e.g., `v3`)

**Release checklist:**

```bash
# 1. Update CHANGELOG.md with new version section
# 2. Update version in package.json
# 3. Commit changes
git add CHANGELOG.md package.json
git commit -m "Bump version to X.Y.Z"

# 4. Push to main
git push origin main

# 5. Create GitHub release
gh release create vX.Y.Z --title "vX.Y.Z - Release Title" --notes-file - <<EOF
Release notes here...

**Full Changelog**: [CHANGELOG.md](https://github.com/micahstubbs/gpt-code-review/blob/main/CHANGELOG.md#xyz---yyyy-mm-dd)
EOF

# 6. Update floating major tag
git tag -f vX vX.Y.Z
git push origin vX --force
```

## Parallel Development Workflow

### Git Worktrees

This project has pre-configured git worktrees available for parallel development workflows, particularly useful when using the `superpowers:dispatching-parallel-agents` skill:

- `~/workspace/worktrees/ChatGPT-CodeReview-worktree-0`
- `~/workspace/worktrees/ChatGPT-CodeReview-worktree-1`
- `~/workspace/worktrees/ChatGPT-CodeReview-worktree-2`
- `~/workspace/worktrees/ChatGPT-CodeReview-worktree-3`
- `~/workspace/worktrees/ChatGPT-CodeReview-worktree-4`

**Usage:**

- Each worktree is a separate working directory sharing the same git repository
- Use worktrees to work on multiple branches simultaneously without switching contexts
- Ideal for parallel agent workflows where multiple independent tasks need isolated workspaces
- Each worktree can be on a different branch, allowing concurrent development without conflicts

**Example:**

```bash
# Worktree-0 working on feature A
cd ~/workspace/worktrees/ChatGPT-CodeReview-worktree-0
git checkout 30/phase1-critical-security-fixes

# Worktree-1 working on feature B
cd ~/workspace/worktrees/ChatGPT-CodeReview-worktree-1
git checkout 25/fix-404-authorization-bug

# Both can be modified simultaneously without interference
```

## Issue Tracking with Beads

This project uses **beads** (`bd`) for issue tracking and **beads_viewer** (`bv`) for visualization.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

### Using bv as an AI sidecar

bv is a graph-aware triage engine for Beads projects (.beads/beads.jsonl). Instead of parsing JSONL or hallucinating graph traversal, use robot flags for deterministic, dependency-aware outputs with precomputed metrics (PageRank, betweenness, critical path, cycles, HITS, eigenvector, k-core).

**Scope boundary:** bv handles *what to work on* (triage, priority, planning). For agent-to-agent coordination (messaging, work claiming, file reservations), use [MCP Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail).

**⚠️ CRITICAL: Use ONLY `--robot-*` flags. Bare `bv` launches an interactive TUI that blocks your session.**

#### The Workflow: Start With Triage

**`bv --robot-triage` is your single entry point.** It returns everything you need in one call:
- `quick_ref`: at-a-glance counts + top 3 picks
- `recommendations`: ranked actionable items with scores, reasons, unblock info
- `quick_wins`: low-effort high-impact items
- `blockers_to_clear`: items that unblock the most downstream work
- `project_health`: status/type/priority distributions, graph metrics
- `commands`: copy-paste shell commands for next steps

```bash
bv --robot-triage        # THE MEGA-COMMAND: start here
bv --robot-next          # Minimal: just the single top pick + claim command
```

#### Other Commands

**Planning:**
| Command | Returns |
|---------|---------|
| `--robot-plan` | Parallel execution tracks with `unblocks` lists |
| `--robot-priority` | Priority misalignment detection with confidence |

**Graph Analysis:**
| Command | Returns |
|---------|---------|
| `--robot-insights` | Full metrics: PageRank, betweenness, HITS (hubs/authorities), eigenvector, critical path, cycles, k-core, articulation points, slack |
| `--robot-label-health` | Per-label health: `health_level` (healthy\|warning\|critical), `velocity_score`, `staleness`, `blocked_count` |
| `--robot-label-flow` | Cross-label dependency: `flow_matrix`, `dependencies`, `bottleneck_labels` |
| `--robot-label-attention [--attention-limit=N]` | Attention-ranked labels by: (pagerank × staleness × block_impact) / velocity |

**History & Change Tracking:**
| Command | Returns |
|---------|---------|
| `--robot-history` | Bead-to-commit correlations: `stats`, `histories` (per-bead events/commits/milestones), `commit_index` |
| `--robot-diff --diff-since <ref>` | Changes since ref: new/closed/modified issues, cycles introduced/resolved |

**Other Commands:**
| Command | Returns |
|---------|---------|
| `--robot-burndown <sprint>` | Sprint burndown, scope changes, at-risk items |
| `--robot-forecast <id\|all>` | ETA predictions with dependency-aware scheduling |
| `--robot-alerts` | Stale issues, blocking cascades, priority mismatches |
| `--robot-suggest` | Hygiene: duplicates, missing deps, label suggestions, cycle breaks |
| `--robot-graph [--graph-format=json\|dot\|mermaid]` | Dependency graph export |
| `--export-graph <file.html>` | Self-contained interactive HTML visualization |

#### Scoping & Filtering

```bash
bv --robot-plan --label backend              # Scope to label's subgraph
bv --robot-insights --as-of HEAD~30          # Historical point-in-time
bv --recipe actionable --robot-plan          # Pre-filter: ready to work (no blockers)
bv --recipe high-impact --robot-triage       # Pre-filter: top PageRank scores
bv --robot-triage --robot-triage-by-track    # Group by parallel work streams
bv --robot-triage --robot-triage-by-label    # Group by domain
```

#### Understanding Robot Output

**All robot JSON includes:**
- `data_hash` — Fingerprint of source beads.jsonl (verify consistency across calls)
- `status` — Per-metric state: `computed|approx|timeout|skipped` + elapsed ms
- `as_of` / `as_of_commit` — Present when using `--as-of`; contains ref and resolved SHA

**Two-phase analysis:**
- **Phase 1 (instant):** degree, topo sort, density — always available immediately
- **Phase 2 (async, 500ms timeout):** PageRank, betweenness, HITS, eigenvector, cycles — check `status` flags

**For large graphs (>500 nodes):** Some metrics may be approximated or skipped. Always check `status`.

#### jq Quick Reference

```bash
bv --robot-triage | jq '.quick_ref'                        # At-a-glance summary
bv --robot-triage | jq '.recommendations[0]'               # Top recommendation
bv --robot-plan | jq '.plan.summary.highest_impact'        # Best unblock target
bv --robot-insights | jq '.status'                         # Check metric readiness
bv --robot-insights | jq '.Cycles'                         # Circular deps (must fix!)
bv --robot-label-health | jq '.results.labels[] | select(.health_level == "critical")'
```

**Performance:** Phase 1 instant, Phase 2 async (500ms timeout). Prefer `--robot-plan` over `--robot-insights` when speed matters. Results cached by data hash.

Use bv instead of parsing beads.jsonl—it computes PageRank, critical paths, cycles, and parallel tracks deterministically.

### Session Completion (Landing the Plane)

When ending a work session, you MUST complete ALL steps:

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```

## Important Notes

- **Use yarn, not npm** - Project uses Yarn Classic (v1)
- **Responses API required for GPT-5.1** - See `GPT-5.1-MIGRATION-REQUIRED.md` for details
- **Dual API support** - `src/chat.ts` automatically detects model type and uses appropriate API
- **JSON output enforced** - All models return structured `{ lgtm, review_comment }` format
- **Rate limiting** - Consider MAX_PATCH_LENGTH and file filtering to control API costs
