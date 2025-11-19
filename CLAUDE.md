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

### Chat Completions API Models
- `gpt-4o`, `gpt-4o-mini` (recommended)
- `gpt-3.5-turbo`

### Responses API Models (GPT-5.1+)
- `gpt-5.1` - Enhanced reasoning model
- `gpt-5.1-codex` - Optimized for code review
- `gpt-5.1-codex-mini` - Cost-effective variant
- `gpt-5-pro` - Premium tier with extended reasoning

**Key Difference**: GPT-5.1 models use `src/chat.ts:codeReviewWithResponsesAPI()` which supports:
- Chain of thought (CoT) passing
- Reasoning effort control (`REASONING_EFFORT`: none/minimal/low/medium/high)
- Structured output schema (instead of `response_format`)

## Environment Variables

### Required
- `OPENAI_API_KEY` - OpenAI API key (or set in GitHub repo variables)
- `APP_ID` - GitHub App ID (for self-hosted bot)
- `PRIVATE_KEY` - GitHub App private key (for self-hosted bot)

### Optional
- `MODEL` - Model name (default: `gpt-4o-mini`)
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

## Important Notes

- **Use yarn, not npm** - Project uses Yarn Classic (v1)
- **Responses API required for GPT-5.1** - See `GPT-5.1-MIGRATION-REQUIRED.md` for details
- **Dual API support** - `src/chat.ts` automatically detects model type and uses appropriate API
- **JSON output enforced** - All models return structured `{ lgtm, review_comment }` format
- **Rate limiting** - Consider MAX_PATCH_LENGTH and file filtering to control API costs
