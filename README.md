# GPT 5.x PR Reviewer

> AI-powered code review for Pull Requests using GPT-5.2, GPT-5.2-Pro, GPT-5.1, and GPT-4o

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-GPT%205.x%20PR%20Reviewer-blue?logo=github)](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

Translation Versions: [ENGLISH](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md)

## Quick Start

### Option 1: Install the GitHub App (Recommended)

The easiest way to get started - install our GitHub App and it will automatically review PRs.

1. **Install the App**: [GPT-5.2 PR Review](https://github.com/apps/gpt-5-2-pr-review)

2. **Select repositories** to enable code review on

3. **Done!** The bot will automatically review new Pull Requests

Reviews appear with the GPT-5.2 branding and avatar.

### Option 2: GitHub Actions

Run as a GitHub Action in your own workflow with your own OpenAI API key.

1. Add `OPENAI_API_KEY` to your repository secrets

2. Create `.github/workflows/cr.yml`:

```yml
name: Code Review

permissions:
  contents: read
  pull-requests: write

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: micahstubbs/gpt-code-review@v3
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          MODEL: gpt-5.2-2025-12-11
```

## Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `MODEL` | OpenAI model to use | `gpt-5.2-2025-12-11` |
| `LANGUAGE` | Response language | English |
| `PROMPT` | Custom review prompt | (built-in) |
| `MAX_PATCH_LENGTH` | Skip files with larger diffs | unlimited |
| `IGNORE_PATTERNS` | Glob patterns to ignore | none |
| `INCLUDE_PATTERNS` | Glob patterns to include | all |
| `REASONING_EFFORT` | GPT-5.x reasoning level | medium |
| `VERBOSITY` | Response detail level | medium |

### Supported Models

| Model | Description |
|-------|-------------|
| `gpt-5.2-2025-12-11` | Recommended - excellent balance of quality and cost |
| `gpt-5.2-pro-2025-12-11` | Premium tier for complex/critical reviews |
| `gpt-5.1-codex` | Optimized for code review |
| `gpt-5.1-codex-mini` | Cost-effective option |
| `gpt-5.1` | General purpose |
| `gpt-4o`, `gpt-4o-mini` | Previous generation |

### Alternative Providers

**GitHub Models:**
```yml
env:
  USE_GITHUB_MODELS: true
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  MODEL: openai/gpt-4o
```

**Azure OpenAI:**
```yml
env:
  AZURE_API_VERSION: 2024-02-15-preview
  AZURE_DEPLOYMENT: your-deployment-name
  OPENAI_API_ENDPOINT: https://your-resource.openai.azure.com
  OPENAI_API_KEY: ${{ secrets.AZURE_OPENAI_KEY }}
```

## Self-hosting

For webhook-based deployment (instead of GitHub Actions):

1. Clone the repository
2. Copy `.env.example` to `.env` and configure
3. Install and run:

```sh
yarn install
yarn build
pm2 start pm2.config.cjs
```

See [Probot documentation](https://probot.github.io/docs/development/) for details.

### Docker

```sh
docker build -t gpt-code-review .
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> gpt-code-review
```

## Development

```sh
# Install dependencies
yarn install

# Build
yarn build

# Run tests
yarn test

# Start locally
yarn start
```

## Contributing

If you have suggestions or want to report a bug, [open an issue](https://github.com/micahstubbs/gpt-code-review/issues).

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## Credit

This project is inspired by [codereview.gpt](https://github.com/sturdy-dev/codereview.gpt)

## License

[ISC](LICENSE) © 2025 anc95, micahstubbs, and contributors
