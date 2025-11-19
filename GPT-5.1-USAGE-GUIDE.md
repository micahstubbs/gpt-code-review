# GPT-5.1 & GPT-5 Pro Models Usage Guide

This guide explains how to use the latest GPT-5.1 and GPT-5 Pro models with ChatGPT-CodeReview.

## Available Models

### GPT-5.1
- **Model ID:** `gpt-5.1`
- **Description:** Enhanced reasoning and conversational model
- **Best for:** General-purpose code review with improved intelligence
- **Context window:** 400K tokens
- **Max output:** 128K tokens
- **Pricing:** $1.25/1M input tokens, $10/1M output tokens

### GPT-5.1-Codex (Recommended)
- **Model ID:** `gpt-5.1-codex`
- **Description:** Specialized for code review and generation tasks
- **Best for:** Agentic code review, bug detection, refactoring suggestions
- **Context window:** 400K tokens
- **Max output:** 128K tokens
- **Pricing:** $1.25/1M input tokens, $10/1M output tokens
- **Special features:** Optimized for long-running coding workflows

### GPT-5.1-Codex-Mini (Cost-Effective)
- **Model ID:** `gpt-5.1-codex-mini`
- **Description:** Compact variant with near state-of-the-art performance
- **Best for:** Budget-conscious teams needing excellent code review
- **Context window:** 400K tokens
- **Max output:** 128K tokens
- **Pricing:** $0.25/1M input tokens, $2/1M output tokens

### GPT-5 Pro (Premium Tier)
- **Model ID:** `gpt-5-pro`
- **Description:** Extended reasoning variant with highest accuracy across difficult tasks
- **Best for:** Critical PRs, security audits, complex architectural reviews, abstract problem solving
- **Context window:** 272K tokens
- **Max output:** 128K tokens (includes reasoning tokens)
- **Pricing:** $15/1M input tokens, $120/1M output tokens
- **Special features:**
  - Parallel test-time compute for maximum accuracy
  - Best for abstract problems requiring novel solutions
  - 94.6% accuracy on AIME 2025 math problems
  - 74.9% on SWE-bench coding benchmarks
- **Note:** Premium pricing - 12x more expensive than GPT-5.1-Codex

## Configuration Examples

### GitHub Actions Setup

#### Standard OpenAI API

```yaml
name: Code Review

permissions:
  contents: read
  pull-requests: write

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: anc95/ChatGPT-CodeReview@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          MODEL: gpt-5.1-codex
          LANGUAGE: English
          max_tokens: 10000
```

#### GitHub Models (if/when available)

```yaml
name: Code Review

permissions:
  contents: read
  pull-requests: write
  models: read

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: anc95/ChatGPT-CodeReview@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          USE_GITHUB_MODELS: true
          MODEL: openai/gpt-5.1-codex
          LANGUAGE: English
```

### Self-Hosted Deployment

Update your `.env` file:

```bash
# OpenAI API Configuration
OPENAI_API_KEY=your-api-key-here
MODEL=gpt-5.1-codex

# Optional: Adjust parameters for GPT-5.1
temperature=0.7
top_p=0.9
max_tokens=10000

# Review settings
LANGUAGE=English
PROMPT=Please perform a thorough code review focusing on bugs, security issues, and best practices
```

## Requirements

### API Access
- **OpenAI API Key:** You need an OpenAI API key with access to GPT-5.1 models
- **Account type:** GPT-5.1 models may require specific account tiers
- **Availability:** Currently in public preview (as of November 2025)

### ⚠️ CRITICAL: Code Migration Required

**The current ChatGPT-CodeReview codebase uses the Chat Completions API, but GPT-5.1 requires the Responses API for optimal performance.**

See [GPT-5.1-MIGRATION-REQUIRED.md](./GPT-5.1-MIGRATION-REQUIRED.md) for detailed migration information.

**Current Status:**
- ✅ GPT-5.1 models will work with existing code
- ⚠️ **BUT:** You will NOT get optimal performance without code migration
- ⚠️ **Missing features:** Reasoning effort control, CoT passing, adaptive reasoning
- ⚠️ **Higher costs:** More reasoning tokens without optimization
- 🚧 **Code migration in progress** - See migration guide

**Recommended Action:**
- For **production use:** Wait for Responses API migration OR use GPT-4o-mini/GPT-4o
- For **testing:** GPT-5.1 will work but with suboptimal performance

### GitHub Copilot Integration
GPT-5.1-Codex is also available through GitHub Copilot:
- Copilot Pro
- Copilot Pro+
- Copilot Business
- Copilot Enterprise

## Cost Considerations

### Pricing Comparison

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Cost Ratio |
|-------|----------------------|------------------------|------------|
| gpt-3.5-turbo | $0.50 | $1.50 | 1x (baseline) |
| gpt-4o | $2.50 | $10.00 | 5x |
| gpt-4o-mini | $0.15 | $0.60 | 0.3x |
| **gpt-5.1** | **$1.25** | **$10.00** | **2.5x** |
| **gpt-5.1-codex** | **$1.25** | **$10.00** | **2.5x** |
| **gpt-5.1-codex-mini** | **$0.25** | **$2.00** | **0.5x** |
| **gpt-5-pro** | **$15.00** | **$120.00** | **30x** |

### Cost Optimization Tips

1. **Use gpt-5.1-codex-mini** for most reviews to save costs
2. **Reserve gpt-5.1-codex** for critical PRs or complex code changes
3. **Use gpt-5-pro ONLY for the most critical reviews** (security audits, major architectural changes)
4. **Set MAX_PATCH_LENGTH** to limit token usage:
   ```yaml
   MAX_PATCH_LENGTH: 10000
   ```
5. **Use INCLUDE_PATTERNS** to review only important files:
   ```yaml
   INCLUDE_PATTERNS: src/**/*.ts,src/**/*.js
   ```
6. **Adjust max_tokens** based on your needs:
   ```yaml
   max_tokens: 5000  # Reduce from default to save on output costs
   ```

### Model Selection Strategy

- **Daily PRs, routine changes:** `gpt-5.1-codex-mini` ($0.25/$2)
- **Important features, refactoring:** `gpt-5.1-codex` ($1.25/$10)
- **Security-critical, production releases:** `gpt-5-pro` ($15/$120)

## Performance Benefits

### Why Use GPT-5.1-Codex for Code Review?

1. **Enhanced Reasoning:** Better at understanding complex code logic and edge cases
2. **Improved Bug Detection:** More accurate identification of potential issues
3. **Better Context Understanding:** 400K context window handles larger PRs
4. **Agentic Behavior:** Designed for multi-step reasoning in code review tasks
5. **Security Focus:** Better at identifying security vulnerabilities

### Benchmark Results

Based on OpenAI's official benchmarks:
- **SWE-bench Verified:** 76.3% (GPT-5.1-Codex)
- **Code understanding:** Significantly improved over GPT-4o
- **Bug detection:** Higher accuracy in identifying subtle issues

## Known Issues & Limitations

### API Availability
Some users have reported errors when accessing GPT-5.1 models:
```
400 Bad Request: {"detail":"The 'gpt-5.1-codex' model is not supported when using Codex with a ChatGPT account."}
```

**Solutions:**
- Ensure your OpenAI account has API access (not just ChatGPT access)
- Verify your API key has GPT-5.1 model permissions
- Check OpenAI's status page for model availability

### Account Type Restrictions
- GPT-5.1 models may not be available to all account types
- Public preview access may be limited
- Contact OpenAI support if you encounter access issues

## Migration Guide

### From GPT-4o to GPT-5.1-Codex

**Before:**
```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  MODEL: gpt-4o
```

**After:**
```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  MODEL: gpt-5.1-codex
  # Optionally adjust parameters
  max_tokens: 10000
  temperature: 0.7
```

**No code changes required!** The existing ChatGPT-CodeReview codebase already supports GPT-5.1 models through the `MODEL` environment variable.

## Testing Your Configuration

### Verify GPT-5.1 Access

1. Create a test pull request in your repository
2. Check the GitHub Actions logs for model initialization
3. Look for successful API calls to GPT-5.1 models
4. Verify the review quality and response time

### Example Test PR

Create a simple PR with this change:
```javascript
// Add a function with an obvious bug
function divide(a, b) {
  return a / b;  // Missing zero check!
}
```

GPT-5.1-Codex should identify:
- Missing zero division check
- Lack of input validation
- No error handling
- Missing JSDoc documentation

## Advanced Configuration

### Custom Prompt for GPT-5.1

Leverage GPT-5.1's enhanced reasoning with a detailed prompt:

```yaml
env:
  MODEL: gpt-5.1-codex
  PROMPT: |
    You are an expert code reviewer. Analyze the following code diff and provide:
    1. Security vulnerabilities (OWASP Top 10)
    2. Performance issues and optimization opportunities
    3. Code quality and maintainability concerns
    4. Potential bugs and edge cases
    5. Best practices violations

    Focus on critical issues that could impact production.
```

### Combining with Other Settings

```yaml
env:
  MODEL: gpt-5.1-codex
  LANGUAGE: English
  temperature: 0.7        # Balanced creativity/consistency
  top_p: 0.9             # Slightly more deterministic
  max_tokens: 15000      # Allow detailed reviews
  MAX_PATCH_LENGTH: 20000 # Review larger PRs
  INCLUDE_PATTERNS: src/**/*.ts,src/**/*.js
  IGNORE_PATTERNS: **/*.test.ts,**/*.spec.ts,**/node_modules/**
```

## Frequently Asked Questions

### Q: Do I need to modify any code to use GPT-5.1?
**A:** No! Simply change the `MODEL` environment variable to your desired GPT-5.1 model.

### Q: Which model should I use?
**A:**
- For **most code reviews**: `gpt-5.1-codex-mini` (best value)
- For **important PRs**: `gpt-5.1-codex` (best quality/cost balance)
- For **critical security/architectural reviews**: `gpt-5-pro` (highest accuracy, premium cost)

### Q: Will GPT-5.1 work with GitHub Models?
**A:** GitHub Models support is pending official availability. Currently, use the standard OpenAI API.

### Q: How much will these models cost compared to GPT-4o?
**A:**
- **gpt-5.1-codex-mini**: 90% cheaper than GPT-4o ($0.25 vs $2.50 input)
- **gpt-5.1-codex**: 50% cheaper than GPT-4o ($1.25 vs $2.50 input)
- **gpt-5-pro**: 6x more expensive than GPT-4o ($15 vs $2.50 input)

### Q: Can I use GPT-5.1 with Azure OpenAI?
**A:** Azure OpenAI support depends on model availability in your region. Check Azure's model catalog.

### Q: What if I get a 400 error?
**A:** Ensure your API key has GPT-5.1 access. Contact OpenAI support if the issue persists.

## Resources

### Official Documentation
- [OpenAI GPT-5.1 Announcement](https://openai.com/index/gpt-5-1/)
- [OpenAI Platform Docs - GPT-5.1-Codex](https://platform.openai.com/docs/models/gpt-5.1-codex)
- [GitHub Blog - GPT-5.1 in Copilot](https://github.blog/changelog/2025-11-13-openais-gpt-5-1-gpt-5-1-codex-and-gpt-5-1-codex-mini-are-now-in-public-preview-for-github-copilot/)

### ChatGPT-CodeReview Resources
- [Main Repository](https://github.com/anc95/ChatGPT-CodeReview)
- [GitHub Marketplace Action](https://github.com/marketplace/actions/chatgpt-codereviewer)
- [Issue Tracker](https://github.com/anc95/ChatGPT-CodeReview/issues)

## Support

If you encounter issues with GPT-5.1 models:
1. Check the [Investigation Report](./GPT-5-FORK-INVESTIGATION.md) for known issues
2. Open an issue in the [ChatGPT-CodeReview repository](https://github.com/anc95/ChatGPT-CodeReview/issues)
3. Contact OpenAI support for API access issues

## Changelog

### 2025-11-18
- Added GPT-5.1 model support documentation
- Created usage guide with configuration examples
- Documented pricing and cost optimization strategies
- Added troubleshooting section for common issues

---

**Last Updated:** 2025-11-18
**GPT-5.1 Release Date:** 2025-11-13
