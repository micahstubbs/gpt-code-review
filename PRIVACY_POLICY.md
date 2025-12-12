# Privacy Policy

**Effective Date:** December 11, 2025

## Overview

GPT-5.2 PR Review is committed to protecting your privacy. This policy explains how we handle data when you use our GitHub App.

## Data Collection

**We do not collect, store, or log any user data.**

## How the App Works

When you use GPT-5.2 PR Review:

1. The app receives webhook events from GitHub when Pull Requests are opened or updated
2. Your code changes (diffs) are sent directly to OpenAI's API using your own API key
3. The AI-generated review is posted back to your Pull Request
4. No code, reviews, or personal information is stored on our servers

## Your API Key

Your OpenAI API key is stored as a GitHub repository variable. We never have access to your API key. All API calls to OpenAI are made directly using your credentials.

## Third-Party Services

This app interacts with:

- **GitHub API** - To read Pull Request data and post review comments
- **OpenAI API** - To generate code reviews (using your API key)

Please refer to their respective privacy policies:
- [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement)
- [OpenAI Privacy Policy](https://openai.com/privacy)

## Open Source

This project is fully open source. You can review the code at [github.com/micahstubbs/gpt-code-review](https://github.com/micahstubbs/gpt-code-review) to verify our privacy practices.

## Self-Hosting

For maximum privacy control, you can self-host this application using GitHub Actions or deploy your own instance. See the README for instructions.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Effective Date" above and committed to this repository.

## Contact

If you have questions about this privacy policy, please [open an issue](https://github.com/micahstubbs/gpt-code-review/issues) on our GitHub repository.
