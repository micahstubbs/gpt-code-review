# Investigation Report: GPT-5.1 Support in ChatGPT-CodeReview Forks

**Date:** 2025-11-18
**Repository Investigated:** https://github.com/anc95/ChatGPT-CodeReview
**Total Forks:** 460
**Models Searched For:**
- GPT-5.1 (`gpt-5.1`)
- GPT-5.1-Codex (`gpt-5.1-codex`)
- GPT-5.1-Codex-Mini (`gpt-5.1-codex-mini`)
- GPT-5-Pro (`gpt-5-pro`)

## Executive Summary

After conducting an extensive investigation using multiple search strategies, **no forks of the ChatGPT-CodeReview repository were found that explicitly implement support for GPT-5.1, GPT-5.1-Codex, or GPT-5-Pro models**.

However, the good news is that **the existing architecture of ChatGPT-CodeReview should already support these models** through the `MODEL` environment variable, as the codebase passes the model parameter directly to the OpenAI API.

## Investigation Methodology

### Search Strategies Employed

1. **Web searches** for:
   - Direct mentions of GPT-5.1/GPT-5.1-Codex in ChatGPT-CodeReview forks
   - GitHub commits and pull requests mentioning these models
   - Fork network analysis
   - Alternative model implementations (DeepSeek, Claude, Gemini)

2. **Repository analysis**:
   - Examined main repository code structure
   - Reviewed `src/chat.ts` for model configuration
   - Checked `.env.example` for supported parameters
   - Analyzed README documentation
   - Searched for relevant issues and pull requests

3. **Network exploration**:
   - Checked fork network at https://github.com/anc95/ChatGPT-CodeReview/network/members
   - Examined notable forks (e.g., repo-racers/gpt-codereview-action)
   - Looked for recent activity and updates in November 2025

## Current Model Support in ChatGPT-CodeReview

### Architecture Analysis

The current implementation (as of the local repository) shows:

**File: `/home/m/workspace/ChatGPT-CodeReview/src/chat.ts`**

```typescript
model: process.env.MODEL || (this.isGithubModels ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'),
```

This implementation allows any model name to be passed via the `MODEL` environment variable, with the default being:
- `gpt-4o-mini` for standard OpenAI
- `openai/gpt-4o-mini` for GitHub Models

### Supported Deployment Methods

1. **Standard OpenAI API**
   - Endpoint: `https://api.openai.com/v1`
   - Configure via: `OPENAI_API_KEY` and `MODEL` environment variables

2. **GitHub Models**
   - Endpoint: `https://models.github.ai/inference`
   - Configure via: `USE_GITHUB_MODELS: true` and `MODEL` environment variables

3. **Azure OpenAI**
   - Configure via: `AZURE_API_VERSION` and `AZURE_DEPLOYMENT` environment variables

### GPT-5.1 Model Availability Context

Based on web research findings:

- **GPT-5.1, GPT-5.1-Codex, and GPT-5.1-Codex-Mini** were announced on **November 13, 2025** (5 days before this investigation)
- These models are currently rolling out in **public preview** for GitHub Copilot
- Available to: Copilot Pro, Pro+, Business, and Enterprise users
- Model capabilities:
  - 400K context window
  - 128K max output
  - Reasoning token support
  - Pricing: $1.25/$10 for GPT-5.1 & GPT-5.1-Codex, $0.25/$2 for Codex-mini

## Notable Forks Examined

### 1. repo-racers/gpt-codereview-action

**URL:** https://github.com/repo-racers/gpt-codereview-action

**Findings:**
- Described as a customized fork with dedicated technical support
- **No explicit GPT-5.1 support found** in README or `src/chat.ts`
- Uses same architecture as main repository
- Default model: `gpt-3.5-turbo`
- Should support GPT-5.1 via `MODEL` environment variable

### 2. Other Observed Forks

From the network graph (https://github.com/anc95/ChatGPT-CodeReview/network/members):
- 460 total forks listed
- Several forks with modified names observed:
  - "Bard-CodeReview-fork"
  - "Gemini-CodeReview"
  - "CodeReview-GPT"
- **None explicitly mentioned GPT-5.1, GPT-5.1-Codex, or GPT-5-Pro in search results**

## Issues and Pull Requests Analysis

### Main Repository Issues

Checked: https://github.com/anc95/ChatGPT-CodeReview/issues

**Relevant Issues Found:**
- Issue #189: "Support GitHub Models inference provider" (opened Jul 29, 2025) - IMPLEMENTED
- Issue #147: "[Feature Request] More LLM support" (opened Jun 20, 2024)
- Issue #175: "Is that support deepseek?" (opened Jan 28, 2025)

**No issues found mentioning:**
- GPT-5
- GPT-5.1
- GPT-5.1-Codex
- GPT-5-Pro

### Pull Requests

Checked: https://github.com/anc95/ChatGPT-CodeReview/pulls

**Findings:**
- 5 open pull requests
- None mention GPT-5 models or recent model updates
- No merged PRs found specifically for GPT-5.1 support

## Technical Compatibility Assessment

### Should GPT-5.1 Models Work?

**YES** - The current codebase should support GPT-5.1 models without modification because:

1. **Flexible model parameter**: The code accepts any model name via `process.env.MODEL`
2. **Standard OpenAI SDK**: Uses official OpenAI Node.js library
3. **Pass-through architecture**: Model name is passed directly to OpenAI API
4. **No model validation**: No hardcoded checks limiting which models can be used

### How to Use GPT-5.1 Models (Theoretical)

Based on the current architecture, users should be able to use GPT-5.1 models by setting:

**For GitHub Actions:**
```yaml
- uses: anc95/ChatGPT-CodeReview@main
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    MODEL: gpt-5.1  # or gpt-5.1-codex or gpt-5.1-codex-mini
```

**For GitHub Models (if/when available):**
```yaml
- uses: anc95/ChatGPT-CodeReview@main
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    USE_GITHUB_MODELS: true
    MODEL: openai/gpt-5.1-codex
```

### Potential Issues

Some users have reported issues with GPT-5.1-Codex:
- GitHub Issue openai/codex#6582: "Cannot use GPT-5.1-codex from latest alpha"
- Error: `400 Bad Request: {"detail":"The 'gpt-5.1-codex' model is not supported when using Codex with a ChatGPT account."}`
- This suggests API access restrictions may apply depending on account type

## Search Query Results Summary

### Queries Executed

1. `ChatGPT-CodeReview fork GPT-5.1 OR GPT-5.1-Codex OR GPT-5-Pro site:github.com`
   - **Result:** No relevant forks found

2. `"anc95/ChatGPT-CodeReview" fork "gpt-5.1" OR "gpt-5.1-codex" OR "gpt-5-pro"`
   - **Result:** General GPT-5.1 information, no specific forks

3. `ChatGPT-CodeReview GPT-5.1 model support github fork`
   - **Result:** Main repo and related projects, no GPT-5.1 forks

4. `"gpt-5.1" OR "gpt-5.1-codex" commit github code review 2025`
   - **Result:** GitHub Copilot announcements, no ChatGPT-CodeReview commits

5. `github commit message "gpt-5.1" OR "gpt-5-pro" code review action`
   - **Result:** Official announcements only

6. `"ChatGPT-CodeReview" OR "gpt-codereview" "gpt-5.1-codex" implementation`
   - **Result:** No implementations found

## Alternative Model Support in Ecosystem

While searching for GPT-5.1 support, I also investigated forks supporting alternative models:

### Models Requested by Community

Based on issues and discussions:
- **DeepSeek** (Issue #175)
- **Claude** (mentioned in fork names)
- **Gemini** (mentioned in fork names)
- **Bard** (mentioned in fork names)

### Theoretical Compatibility

The architecture suggests any OpenAI API-compatible service could work by:
1. Setting `OPENAI_API_ENDPOINT` to the alternative service endpoint
2. Setting `MODEL` to the alternative model name
3. Providing appropriate API key via `OPENAI_API_KEY`

This means services with OpenAI-compatible APIs (like many open-source LLM providers) could theoretically work.

## Conclusions

### Key Findings

1. **No forks found** with explicit GPT-5.1, GPT-5.1-Codex, or GPT-5-Pro support documentation
2. **No commits or PRs found** in the fork network adding these models
3. **No issues found** specifically requesting GPT-5.1 support (likely because it's so new)
4. **Existing architecture should support** these models without modification
5. **Models are very recent** (announced Nov 13, 2025, only 5 days before investigation)

### Why No Forks Were Found

Several possible explanations:

1. **Timing**: GPT-5.1 models were announced only 5 days ago
2. **No modification needed**: Current architecture already supports any model via environment variable
3. **API access**: Models may not be widely available yet (currently in public preview)
4. **Account restrictions**: Some users report 400 errors when trying to use GPT-5.1-Codex
5. **Focus on GitHub Copilot**: Official GPT-5.1 integration is primarily through GitHub Copilot, not direct API

### Recommendations

For users wanting to use GPT-5.1 models with ChatGPT-CodeReview:

1. **Test with existing codebase**: Simply set `MODEL=gpt-5.1` or `MODEL=gpt-5.1-codex` in your environment
2. **Verify API access**: Ensure your OpenAI account has access to GPT-5.1 models
3. **Monitor costs**: GPT-5.1 pricing is higher ($1.25/$10) than GPT-4o
4. **Consider alternatives**:
   - GPT-5.1-Codex-Mini for cost savings ($0.25/$2)
   - Standard GPT-4o which is well-tested
5. **Watch for updates**: Check if GitHub Models adds GPT-5.1 support

## Additional Context

### GitHub Copilot Integration

GPT-5.1-Codex is officially available in:
- GitHub Copilot (Pro, Pro+, Business, Enterprise)
- Codex CLI and IDE integrations
- @codex mentions in pull requests and issues

This may reduce demand for direct API integration in code review tools, as many users may prefer the native GitHub integration.

### Model Performance Notes

From research findings:
- GPT-5.1-Codex achieved 76.3% on SWE-bench Verified
- Designed for "long-running, agentic coding tasks"
- Includes new tools: `apply_patch` and `shell`
- Some users report GPT-5 models being "forgetful" or "not following instructions well"

## Investigation Limitations

1. **Search engine coverage**: Web searches may not index all fork commits
2. **Private forks**: Cannot access private repository forks
3. **Recent changes**: Forks updated in last 5 days may not be indexed yet
4. **Language barrier**: Did not search in non-English languages
5. **Fork scale**: 460 forks is difficult to manually review exhaustively

## Files Examined in Local Repository

1. `/home/m/workspace/ChatGPT-CodeReview/src/chat.ts`
2. `/home/m/workspace/ChatGPT-CodeReview/.env.example`
3. `/home/m/workspace/ChatGPT-CodeReview/README.md`

## References

### Official Documentation
- GitHub Blog: "OpenAI's GPT-5.1, GPT-5.1-Codex and GPT-5.1-Codex-Mini are now in public preview for GitHub Copilot"
- OpenAI: "Introducing GPT-5.1 for developers"
- OpenAI Platform Docs: GPT-5.1-Codex model documentation

### Repository Links
- Main repo: https://github.com/anc95/ChatGPT-CodeReview
- Network graph: https://github.com/anc95/ChatGPT-CodeReview/network/members
- Notable fork: https://github.com/repo-racers/gpt-codereview-action

### Related Issues
- openai/codex#6582: Cannot use GPT-5.1-codex from latest alpha
- openai/codex#6603: 400 Bad Request error for gpt-5.1-codex
- anc95/ChatGPT-CodeReview#189: Support GitHub Models inference provider

## Next Steps

If you want to pursue GPT-5.1 support further:

1. **Create an issue** in the main repository requesting GPT-5.1 documentation/testing
2. **Test directly** with the existing codebase using `MODEL=gpt-5.1-codex`
3. **Document findings** and share with the community
4. **Monitor** for official announcements about GPT-5.1 API availability
5. **Consider creating a fork** with tested GPT-5.1 configurations if successful

---

**Investigation Status:** COMPLETE
**Conclusion:** No forks found with explicit GPT-5.1 support, but existing architecture should support it via MODEL environment variable configuration.
