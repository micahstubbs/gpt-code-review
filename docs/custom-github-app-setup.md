# Custom GitHub App Setup Guide

This guide walks you through creating a custom GitHub App for branded code review comments. Instead of reviews appearing from "github-actions[bot]", they'll show your custom app name and avatar (e.g., "GPT-5.2" with a custom logo).

## Why Use a Custom GitHub App?

- **Brand recognition**: Custom name and avatar for your organization
- **Clarity**: Distinguish AI code reviews from other GitHub Actions
- **Trust**: Clear identification of which tool reviewed the code

## Prerequisites

- GitHub account with permission to create GitHub Apps
- Repository where you want to use the code reviewer

## Step 1: Create a New GitHub App

1. Go to **GitHub Settings** → **Developer settings** → **GitHub Apps**
   - Direct link: https://github.com/settings/apps/new

2. Fill in the **Basic information**:
   - **GitHub App name**: Choose a descriptive name (e.g., "GPT Code Reviewer", "Acme AI Reviews")
   - **Description**: Optional description of your app
   - **Homepage URL**: Your organization's URL or the repository URL

## Step 2: Configure Identifying Users

In the **Identifying and authorizing users** section:

- **Callback URL**: Leave empty (not needed for GitHub Actions usage)
- **Expire user authorization tokens**: Keep checked (default)
- **Request user authorization (OAuth) during installation**: Leave unchecked
- **Enable Device Flow**: Leave unchecked

## Step 3: Configure Post Installation

In the **Post installation** section:

- **Setup URL**: Leave empty
- **Redirect on update**: Leave unchecked

## Step 4: Configure Webhook

In the **Webhook** section:

- **Active**: **Uncheck this box** (webhooks are not needed for GitHub Actions usage)
- **Webhook URL**: Leave empty
- **Secret**: Leave empty

> **Note**: Since we're using this app with GitHub Actions (not as a webhook-driven bot), webhooks are not required.

## Step 5: Set Permissions

Expand **Repository permissions** and set:

| Permission | Access Level | Purpose |
|------------|--------------|---------|
| **Contents** | Read | Read repository files and diffs |
| **Pull requests** | Write | Post review comments on PRs |
| **Metadata** | Read | Required (automatically selected) |

Leave all other permissions as "No access".

**Organization permissions**: None required

**Account permissions**: None required

## Step 6: Subscribe to Events

In the **Subscribe to events** section:

- Leave all events **unchecked**

> **Note**: Event subscriptions are only needed for webhook-driven apps. GitHub Actions workflows are triggered by workflow events, not app webhooks.

## Step 7: Installation Scope

Under **Where can this GitHub App be installed?**:

- **Only on this account**: Select this for personal/organization use
- **Any account**: Select this only if you plan to distribute the app publicly

## Step 8: Create the App

Click **Create GitHub App**.

## Step 9: Generate a Private Key

After creating the app:

1. On the app settings page, scroll to **Private keys**
2. Click **Generate a private key**
3. A `.pem` file will download automatically
4. Save this file securely - you'll need its contents for GitHub Secrets

## Step 10: Note Your App ID

On the app settings page, find the **App ID** (a numeric value like `123456`). You'll need this for configuration.

## Step 11: Upload an Avatar (Optional)

1. On the app settings page, click **Upload a logo**
2. Upload a square image (recommended: 512x512 pixels)
3. This avatar will appear next to all review comments

## Step 12: Install the App on Your Repository

1. On the app settings page, click **Install App** in the left sidebar
2. Select your account or organization
3. Choose **Only select repositories** and select the repositories where you want code reviews
4. Click **Install**

## Step 13: Configure GitHub Actions Secrets

In your repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**

2. Add a new **Repository secret**:
   - Name: `CODE_REVIEW_APP_PRIVATE_KEY`
   - Value: Paste the entire contents of the `.pem` file (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)

3. Switch to the **Variables** tab and add:
   - Name: `CODE_REVIEW_APP_ID`
   - Value: Your App ID (e.g., `123456`)

## Step 14: Update Your Workflow

Update your `.github/workflows/gpt-code-review.yml` to use the custom app:

```yaml
name: GPT Code Review

permissions:
  contents: read

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      # Generate installation token from your custom GitHub App
      - name: Generate App Token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ vars.CODE_REVIEW_APP_ID }}
          private-key: ${{ secrets.CODE_REVIEW_APP_PRIVATE_KEY }}

      # Run code review with custom app identity
      - name: GPT Code Review
        uses: micahstubbs/gpt-code-review@main
        env:
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          MODEL: gpt-5.2-2025-12-11
```

## How It Works

1. The `actions/create-github-app-token` action authenticates as your GitHub App
2. It generates a short-lived installation access token
3. This token is passed to the code review action instead of `GITHUB_TOKEN`
4. All API calls (posting reviews) are made as your custom app
5. Reviews appear with your app's name and avatar

## Troubleshooting

### "Resource not accessible by integration"

- Ensure the app is installed on the repository
- Verify **Pull requests: Write** permission is set
- Re-install the app if permissions were changed after installation

### "Private key is invalid"

- Ensure you copied the entire `.pem` file contents
- Include the `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` lines
- Check for any extra whitespace or line breaks

### "App not installed on repository"

- Go to the app settings and click **Install App**
- Select the repository where the workflow runs

### Reviews still show as "github-actions[bot]"

- Verify the workflow uses `steps.app-token.outputs.token` not `secrets.GITHUB_TOKEN`
- Check that the token generation step completed successfully

## Security Considerations

- Store the private key only in GitHub Secrets (never in code)
- Use the minimum required permissions
- Consider creating separate apps for different purposes
- Regularly rotate private keys if security policies require it

## Comparison: Default vs Custom App

| Aspect | Default (`GITHUB_TOKEN`) | Custom GitHub App |
|--------|--------------------------|-------------------|
| Identity | github-actions[bot] | Your custom name |
| Avatar | GitHub Actions logo | Your custom logo |
| Setup | None required | One-time setup |
| Permissions | Workflow-scoped | App-defined |
| Token Management | Automatic | Via `create-github-app-token` |

## Next Steps

- [Example workflow file](../examples/custom-app-workflow.yml)
- [GitHub Apps documentation](https://docs.github.com/en/apps/creating-github-apps)
- [actions/create-github-app-token](https://github.com/actions/create-github-app-token)
