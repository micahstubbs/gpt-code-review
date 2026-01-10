# GPT 5.x PR Reviewer

> AI-powered code review for Pull Requests using GPT-5.2, GPT-5.2-Pro, GPT-5.1, and GPT-4o

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-GPT%205.x%20PR%20Reviewer-blue?logo=github)](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

Translation Versions: [ENGLISH](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md)

## Quick Start

### Simple Setup (Recommended)

The simplest way to get started - just add your OpenAI API key and a workflow file.

**Step 1: Add your API key**

Go to your repository **Settings** → **Secrets and variables** → **Actions** → **Secrets** tab:
- Click **New repository secret**
- Name: `OPENAI_API_KEY`
- Value: Your OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys)

**Step 2: Add the workflow**

Create `.github/workflows/cr.yml` in your repository:

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

**Done!** Reviews will appear as `github-actions[bot]` comments, and your API key stays encrypted.

<details>
<summary><strong>Custom Branding Setup (Advanced)</strong></summary>

For reviews with a custom bot name and avatar, create your own GitHub App:

**Step 1: Create a GitHub App**

1. Go to **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**
2. Configure:
   - **Name:** Your custom bot name (e.g., "My Code Reviewer")
   - **Homepage URL:** Your repository URL
   - **Webhook:** Uncheck "Active" (not needed for this setup)
   - **Permissions:**
     - Repository → Pull requests: Read & write
     - Repository → Contents: Read-only
3. Click **Create GitHub App**
4. Note the **App ID** shown on the app's settings page
5. Scroll down and click **Generate a private key** - save the downloaded `.pem` file

**Step 2: Install the App**

1. On your app's settings page, click **Install App** in the left sidebar
2. Select the repositories where you want code reviews

**Step 3: Configure Secrets and Variables**

Go to your repository **Settings** → **Secrets and variables** → **Actions**:

| Type | Name | Value |
|------|------|-------|
| **Secret** | `OPENAI_API_KEY` | Your OpenAI API key |
| **Secret** | `CODE_REVIEW_APP_PRIVATE_KEY` | Contents of the `.pem` file you downloaded |
| **Variable** | `CODE_REVIEW_APP_ID` | App ID from Step 1 |

**Step 4: Add the workflow**

Create `.github/workflows/cr.yml`:

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
  code-review:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' &&
       github.event.issue.pull_request &&
       contains(github.event.comment.body, '/gpt-review'))
    steps:
      - name: Generate App Token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ vars.CODE_REVIEW_APP_ID }}
          private-key: ${{ secrets.CODE_REVIEW_APP_PRIVATE_KEY }}

      - uses: micahstubbs/gpt-code-review@v3
        env:
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          MODEL: gpt-5.2-2025-12-11
```

Reviews will now appear with your custom app's name and avatar.

</details>

### On-Demand Reviews

Trigger a review on-demand by commenting `/gpt-review` on any open Pull Request. This is useful for:
- Re-reviewing after making changes
- Reviewing PRs that were opened before the workflow was added
- Getting a fresh review on an existing PR

The bot will add an 👀 reaction to acknowledge the command, then post a review.

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

## Security Considerations

### API Key Storage

All API keys are stored as **repository secrets**, which are:
- Encrypted at rest
- Never exposed in logs
- Only accessible to GitHub Actions workflows

### Built-in Protections

This bot includes several security measures:
- API keys are automatically redacted from error logs (pattern: `sk-*`)
- Error messages never include sensitive data
- The `REQUIRE_MAINTAINER_REVIEW` option (default for public repos) prevents unauthorized users from triggering reviews

### Best Practices

1. **Rotate API keys regularly** - Create a new key every 30-90 days
2. **Set usage limits** - Configure spending limits on your OpenAI account
3. **Monitor usage** - Check OpenAI dashboard for unexpected activity
4. **Use separate keys** - Don't reuse API keys across projects

## Contributing

If you have suggestions or want to report a bug, [open an issue](https://github.com/micahstubbs/gpt-code-review/issues).

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## Credit

This project is inspired by [codereview.gpt](https://github.com/sturdy-dev/codereview.gpt)

## License

[ISC](LICENSE) © 2025 anc95, micahstubbs, and contributors
