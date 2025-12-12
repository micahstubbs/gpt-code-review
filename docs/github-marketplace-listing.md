# GitHub Marketplace Listing

## Summary (500 chars max)

GPT-5.2 PR Review automatically reviews your Pull Requests using OpenAI's latest models. Get instant, intelligent feedback on code quality, potential bugs, and best practices.

**Features:**
- Automatic reviews on every PR
- Supports GPT-5.2, GPT-5.2-Pro, GPT-5.1, and GPT-4o
- Multi-language support (English, Chinese, Japanese, Korean)
- Configurable review prompts and verbosity
- Works with any repository

Just install, add your OpenAI API key as a repository variable, and start getting AI-powered code reviews.

## Detailed Description (1800 chars max)

GPT-5.2 PR Review brings AI-powered code review to your GitHub workflow. Every Pull Request gets automatic, intelligent feedback from OpenAI's most capable models.

**How It Works**

1. Install the app on your repositories
2. Add your OpenAI API key as a repository variable (OPENAI_API_KEY)
3. Open a Pull Request
4. Receive detailed code review comments within seconds

**Supported Models**

- **gpt-5.2-2025-12-11** - Recommended for most reviews. Excellent balance of quality and cost.
- **gpt-5.2-pro-2025-12-11** - Premium tier for complex or critical code reviews.
- **gpt-5.1-codex** - Optimized specifically for code analysis.
- **gpt-5.1-codex-mini** - Cost-effective option for high-volume repositories.
- **gpt-4o / gpt-4o-mini** - Previous generation models still fully supported.

**Configuration Options**

Customize the reviewer behavior through repository variables:

- **MODEL** - Choose which OpenAI model to use
- **LANGUAGE** - Get reviews in English, Chinese, Japanese, Korean, or other languages
- **PROMPT** - Provide custom review instructions
- **MAX_PATCH_LENGTH** - Skip large files to control costs
- **IGNORE_PATTERNS** - Exclude files by glob pattern (e.g., *.md, tests/*)
- **INCLUDE_PATTERNS** - Only review specific file types
- **REASONING_EFFORT** - Control depth of analysis (low/medium/high)
- **VERBOSITY** - Adjust response detail level

**What Gets Reviewed**

The bot analyzes added and modified files in each PR, examining:
- Code quality and best practices
- Potential bugs and edge cases
- Security considerations
- Performance implications
- Readability and maintainability

**Privacy**

Your code is sent directly to OpenAI using your own API key. We do not store or log your code.

**Open Source**

This project is fully open source. Self-host it as a GitHub Action or deploy your own instance. View the source at github.com/micahstubbs/gpt-code-review
