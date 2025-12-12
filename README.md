# GPT 5.x PR Reviewer

> AI-powered code review for Pull Requests using GPT-5.2, GPT-5.2-Pro, GPT-5.1, and GPT-4o

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-GPT%205.x%20PR%20Reviewer-blue?logo=github)](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

Translation Versions: [ENGLISH](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md)

## Quick Start

### Option 1: Custom GitHub App (Recommended)

Use a custom GitHub App for branded reviews with your own name and avatar.

**Setup:**

1. [Create a GitHub App](https://github.com/settings/apps/new) with:
   - **Permissions**: Contents (Read), Pull requests (Write)
   - **Webhook**: Disabled (not needed for Actions)

2. Generate and download a private key from your app settings

3. Add secrets to your repository:
   - `CODE_REVIEW_APP_ID` (as variable)
   - `CODE_REVIEW_APP_PRIVATE_KEY` (as secret)
   - `OPENAI_API_KEY` (as secret)

4. Create `.github/workflows/cr.yml`:

```yml
name: Code Review

permissions:
  contents: read

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: Generate App Token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ vars.CODE_REVIEW_APP_ID }}
          private-key: ${{ secrets.CODE_REVIEW_APP_PRIVATE_KEY }}

      - name: GPT Code Review
        uses: micahstubbs/gpt-code-review@v3
        env:
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          MODEL: gpt-5.2-2025-12-11
```

See the [Custom GitHub App Setup Guide](docs/custom-github-app-setup.md) for detailed instructions.

### Option 2: Default GitHub Actions Bot

Use the default `github-actions[bot]` identity (simpler setup).

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
