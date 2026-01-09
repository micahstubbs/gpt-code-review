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

`bv` is a graph-aware triage engine for Beads projects. Use `--robot-*` flags for deterministic, dependency-aware outputs with precomputed metrics.

**CRITICAL: Use ONLY `--robot-*` flags. Bare `bv` launches an interactive TUI that blocks your session.**

#### The Workflow: Start With Triage

```bash
bv --robot-triage     # THE MEGA-COMMAND: start here
bv --robot-next       # Minimal: just the single top pick + claim command
```

#### Other Commands

| Command | Returns |
|---------|---------|
| `--robot-plan` | Parallel execution tracks with `unblocks` lists |
| `--robot-priority` | Priority misalignment detection |
| `--robot-insights` | Full metrics: PageRank, betweenness, critical path, cycles |
| `--robot-history` | Bead-to-commit correlations |
| `--robot-diff --diff-since <ref>` | Changes since ref |
| `--robot-alerts` | Stale issues, blocking cascades, priority mismatches |

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
