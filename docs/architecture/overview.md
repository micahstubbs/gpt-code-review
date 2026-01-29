# Architecture Overview

GPT Code Review is a GitHub bot built on the [Probot](https://probot.github.io/) framework that reviews Pull Requests using OpenAI models. It supports four deployment targets from a single codebase: GitHub Actions, self-hosted Probot, AWS Lambda, and Vercel Edge.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Events                                │
│         pull_request.opened / .synchronize / issue_comment          │
└──────────────┬──────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Entry Points (Adapters)                         │
│                                                                      │
│  ┌──────────────┐ ┌────────────────┐ ┌────────────┐ ┌────────────┐  │
│  │  index.ts     │ │ github-action  │ │ aws-lambda │ │ middleware  │  │
│  │  (Probot)     │ │ .cjs (Actions) │ │ .cjs       │ │ .ts (Edge) │  │
│  └──────┬───────┘ └───────┬────────┘ └─────┬──────┘ └─────┬──────┘  │
│         └─────────────────┼────────────────┼───────────────┘         │
│                           ▼                ▼                         │
│                    ┌─────────────┐                                    │
│                    │   bot.ts    │                                    │
│                    │  (Router)   │                                    │
│                    └──────┬──────┘                                    │
└───────────────────────────┼──────────────────────────────────────────┘
                            │
               ┌────────────┼────────────────┐
               ▼            ▼                ▼
    ┌──────────────┐ ┌─────────────┐ ┌──────────────────┐
    │ PR Events    │ │ /gpt-review │ │ /gpt-review:     │
    │ (auto)       │ │ (on-demand) │ │  get-models      │
    └──────┬───────┘ └──────┬──────┘ └──────────────────┘
           │                │
           └────────┬───────┘
                    ▼
    ┌───────────────────────────────────┐
    │         performReview()           │
    │                                   │
    │  1. Get changed files (GitHub API)│
    │  2. Filter by patterns            │
    │  3. For each file:                │
    │     └─ chat.codeReview(patch)     │
    │  4. Batch post comments           │
    │     (every 20 files / 30 min)     │
    └───────────────┬───────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────┐
    │           chat.ts                 │
    │       (OpenAI Integration)        │
    │                                   │
    │  Model Detection                  │
    │  ┌─────────────┐                  │
    │  │ isReasoning  │                 │
    │  │ Model()?     │                 │
    │  └──────┬──────┘                  │
    │    yes  │       no                │
    │    ┌────┴────┐  │                 │
    │    │supports │  │                 │
    │    │schema?  │  │                 │
    │    ├────┬────┤  │                 │
    │    │yes │ no │  │                 │
    │    ▼    ▼    ▼  ▼                 │
    │  ┌───┐┌───┐ ┌───┐                │
    │  │ A ││ B │ │ C │                │
    │  └───┘└───┘ └───┘                │
    │                                   │
    │  A: Responses API + Schema        │
    │     (gpt-5.2, gpt-5.1, etc.)     │
    │  B: Responses API + JSON Extract  │
    │     (gpt-5.2-pro)                 │
    │  C: Chat Completions API          │
    │     (gpt-4o, gpt-3.5-turbo)      │
    └───────────────┬───────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────┐
    │      review-formatter.ts          │
    │  Format markdown review comment   │
    └───────────────┬───────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────┐
    │      review-analyzer.ts           │
    │  Severity scoring, quality calc,  │
    │  reviewer authorization cache     │
    └───────────────────────────────────┘
```

## Module Relationships

| Module | Purpose | Depends On |
|--------|---------|------------|
| `bot.ts` | Event routing, file filtering, review orchestration | `chat.ts`, `review-formatter.ts`, `log.ts` |
| `chat.ts` | OpenAI API calls (dual API), streaming, JSON extraction | `review-formatter.ts`, `log.ts` |
| `review-formatter.ts` | Markdown comment formatting | (none) |
| `review-analyzer.ts` | Severity analysis, quality scoring, auth verification | (none) |
| `log.ts` | Logging singleton | (none) |

## Deployment Targets

All four targets share the same `bot.ts` core logic. The adapters translate platform-specific event formats into Probot's internal representation:

| Target | Entry Point | Adapter | Output Dir |
|--------|------------|---------|------------|
| Self-hosted Probot | `src/index.ts` | Direct Probot `run()` | `dist/` |
| GitHub Actions | `src/github-action.cjs` | `@probot/adapter-github-actions` | `action/` |
| AWS Lambda | `src/aws-lambda.cjs` | `@probot/adapter-aws-lambda-serverless` | `lambda/` |
| Vercel Edge | `middleware.ts` | Vercel edge runtime | `dist/` |
