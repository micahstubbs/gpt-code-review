# GPT 5.x PR Reviewer

> AI-powered code review for Pull Requests using GPT-5.2, GPT-5.2-Pro, GPT-5.1, and GPT-4o

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-GPT%205.x%20PR%20Reviewer-blue?logo=github)](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

Translation Versions: [ENGLISH](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md)

## Quick Start

### Install the GitHub App (Recommended)

The easiest way to get started - install our GitHub App and it will automatically review PRs.

1. **Install the App**: [GPT-5.2 PR Review](https://github.com/apps/gpt-5-2-pr-review)

2. **Select repositories** to enable code review on

3. **Configure your OpenAI API key**:
   - Go to your repository **Settings** → **Secrets and variables** → **Actions**
   - Click the **Variables** tab
   - Click **New repository variable**
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys)

   > **Important:** The GitHub App requires a **repository variable** (not a secret). Repository secrets cannot be read by external apps - only GitHub Actions workflows can access secrets.

4. **Done!** The bot will automatically review new Pull Requests

Reviews appear with the GPT-5.2 branding and avatar.

### On-Demand Reviews

You can also trigger a review on-demand by commenting `/gpt-review` on any open Pull Request. This is useful for:
- Re-reviewing after making changes
- Reviewing PRs that were opened before the app was installed
- Getting a fresh review on an existing PR

The bot will add an 👀 reaction to acknowledge the command, then post a review.

<details>
<summary><strong>Option 2: GitHub Actions (Self-hosted)</strong></summary>

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
  issue_comment:
    types: [created]

jobs:
  review:
    runs-on: ubuntu-latest
    # Run on PR events OR when /gpt-review comment is posted on a PR
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' &&
       github.event.issue.pull_request &&
       contains(github.event.comment.body, '/gpt-review'))
    steps:
      - uses: micahstubbs/gpt-code-review@v3
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          MODEL: gpt-5.2-2025-12-11
```

</details>

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
| `AUTO_REVIEW` | Enable automatic reviews on PR open/sync | `true` |
| `REQUIRE_MAINTAINER_REVIEW` | Restrict `/gpt-review` to maintainers | `true` (public repos) |

### On-Demand Only Mode

To conserve OpenAI API tokens, you can disable automatic reviews and only trigger reviews when someone comments `/gpt-review` on a PR:

```yml
env:
  AUTO_REVIEW: false
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

With this configuration, the bot will not review PRs automatically when they are opened or updated. Instead, reviews only happen when a user explicitly requests one by commenting `/gpt-review`.

### Maintainer-Only Reviews

By default, the `/gpt-review` command is restricted to repository maintainers (users with write access or higher) on **public repositories**. This protects repository owners from community members inadvertently consuming their OpenAI API tokens.

**Default behavior:**
- **Public repos:** Only maintainers can use `/gpt-review`
- **Private repos:** Anyone with access can use `/gpt-review`

To override the default behavior:

```yml
env:
  # Allow anyone to trigger reviews (not recommended for public repos)
  REQUIRE_MAINTAINER_REVIEW: false
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Or to enforce maintainer-only mode even on private repos:

```yml
env:
  REQUIRE_MAINTAINER_REVIEW: true
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Supported Models

| Model | Description |
|-------|-------------|
| `gpt-5.2-2025-12-11` | Recommended - excellent balance of quality and cost |
| `gpt-5.2-pro-2025-12-11` | Premium tier for complex/critical reviews |
| `gpt-5.1-codex` | Optimized for code review |
| `gpt-5.1-codex-mini` | Cost-effective option |
| `gpt-5.1` | General purpose |
| `gpt-4o`, `gpt-4o-mini` | Previous generation |

<details>
<summary><strong>Alternative Providers</strong></summary>

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

</details>

<details>
<summary><strong>Self-hosting</strong></summary>

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

</details>

<details>
<summary><strong>Development</strong></summary>

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

</details>

## Contributing

If you have suggestions or want to report a bug, [open an issue](https://github.com/micahstubbs/gpt-code-review/issues).

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## Credit

This project is inspired by [codereview.gpt](https://github.com/sturdy-dev/codereview.gpt)

## License

[ISC](LICENSE) © 2025 anc95, micahstubbs, and contributors
