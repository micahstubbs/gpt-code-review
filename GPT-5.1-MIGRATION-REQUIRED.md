# ⚠️ IMPORTANT: GPT-5.1 Requires Code Migration

## Critical Issue Identified

The current ChatGPT-CodeReview codebase uses the **Chat Completions API** (`/v1/chat/completions`), but **GPT-5.1 models require the Responses API** (`/v1/responses`) for optimal performance.

## Current Status

**File:** `src/chat.ts:62`

```typescript
// CURRENT CODE - Uses Chat Completions API
const res = await this.openai.chat.completions.create({
  messages: [
    {
      role: 'user',
      content: prompt,
    },
  ],
  model: process.env.MODEL || 'gpt-4o-mini',
  temperature: +(process.env.temperature || 0) || 1,
  top_p: +(process.env.top_p || 0) || 1,
  max_tokens: process.env.max_tokens ? +process.env.max_tokens : undefined,
  response_format: {
    type: "json_object"
  },
});
```

## Why Migration is Required

### Chat Completions API Limitations for GPT-5.1

The Chat Completions API **does not support** critical GPT-5.1 features:

1. **❌ No Chain of Thought (CoT) passing** between turns
2. **❌ No reasoning effort control** (none/minimal/low/medium/high)
3. **❌ No adaptive reasoning** optimization
4. **❌ No previous_response_id** for multi-turn conversations
5. **❌ Higher latency** compared to Responses API
6. **❌ Lower cache hit rates**
7. **❌ More generated reasoning tokens** (higher costs)

### Responses API Benefits for GPT-5.1

Using the Responses API provides:

1. **✅ Chain of thought (CoT) passing** - Reuse reasoning between turns
2. **✅ Reasoning effort control** - Optimize speed vs accuracy
3. **✅ Improved intelligence** - Better results with CoT
4. **✅ Lower latency** - Especially with previous_response_id
5. **✅ Higher cache hit rates** - Reduced costs
6. **✅ Fewer reasoning tokens** - Lower costs
7. **✅ Structured outputs** - Better JSON handling

## Migration Guide

### Current API (Chat Completions)

```typescript
// src/chat.ts - CURRENT IMPLEMENTATION
const res = await this.openai.chat.completions.create({
  messages: [{ role: 'user', content: prompt }],
  model: 'gpt-5.1',
  temperature: 0.7,
  max_tokens: 10000,
  response_format: { type: "json_object" }
});
```

### Required API (Responses)

```typescript
// src/chat.ts - REQUIRED FOR GPT-5.1
const res = await this.openai.responses.create({
  model: 'gpt-5.1',
  input: prompt,  // Note: 'input' instead of 'messages'
  reasoning: {
    effort: process.env.REASONING_EFFORT || 'medium'  // none, minimal, low, medium, high
  },
  text: {
    verbosity: process.env.VERBOSITY || 'medium'  // low, medium, high
  },
  // For structured outputs (replaces response_format)
  output_schema: {
    type: "object",
    properties: {
      lgtm: { type: "boolean" },
      review_comment: { type: "string" }
    },
    required: ["lgtm", "review_comment"]
  }
});
```

## Key Differences

| Feature | Chat Completions API | Responses API |
|---------|---------------------|---------------|
| Endpoint | `/v1/chat/completions` | `/v1/responses` |
| Input format | `messages: [...]` | `input: "..."` |
| Temperature | `temperature: 0.7` | Not supported |
| Top-p | `top_p: 0.9` | Not supported |
| Max tokens | `max_tokens: 10000` | Not supported |
| Reasoning control | ❌ Not available | `reasoning: { effort: "medium" }` |
| Verbosity | ❌ Not available | `text: { verbosity: "medium" }` |
| JSON output | `response_format: { type: "json_object" }` | `output_schema: {...}` (structured) |
| CoT passing | ❌ Not available | `previous_response_id: "..."` |
| Multi-turn | Manual message history | Automatic with `previous_response_id` |

## Recommended Implementation

### Option 1: Dual API Support (Recommended)

Support both APIs based on model type:

```typescript
export class Chat {
  private openai: OpenAI | AzureOpenAI;

  // Detect if model requires Responses API
  private isReasoningModel(model: string): boolean {
    const reasoningModels = ['gpt-5.1', 'gpt-5.1-codex', 'gpt-5-pro'];
    return reasoningModels.some(m => model.includes(m));
  }

  public async codeReview(patch: string): Promise<{ lgtm: boolean, review_comment: string }> {
    const model = process.env.MODEL || 'gpt-4o-mini';
    const prompt = this.generatePrompt(patch);

    if (this.isReasoningModel(model)) {
      // Use Responses API for GPT-5.1 models
      return await this.codeReviewWithResponsesAPI(prompt, model);
    } else {
      // Use Chat Completions API for other models
      return await this.codeReviewWithChatAPI(prompt, model);
    }
  }

  private async codeReviewWithResponsesAPI(
    prompt: string,
    model: string
  ): Promise<{ lgtm: boolean, review_comment: string }> {
    const res = await this.openai.responses.create({
      model: model,
      input: prompt,
      reasoning: {
        effort: process.env.REASONING_EFFORT || 'medium'
      },
      text: {
        verbosity: 'medium'
      },
      output_schema: {
        type: "object",
        properties: {
          lgtm: { type: "boolean", description: "True if code looks good to merge" },
          review_comment: { type: "string", description: "Detailed review comments in markdown" }
        },
        required: ["lgtm", "review_comment"],
        additionalProperties: false
      }
    });

    // Extract structured output
    if (res.output && res.output.type === 'object') {
      return res.output.value as { lgtm: boolean, review_comment: string };
    }

    // Fallback
    return { lgtm: false, review_comment: "Error parsing response" };
  }

  private async codeReviewWithChatAPI(
    prompt: string,
    model: string
  ): Promise<{ lgtm: boolean, review_comment: string }> {
    // Existing implementation...
    const res = await this.openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: model,
      temperature: +(process.env.temperature || 0) || 1,
      top_p: +(process.env.top_p || 0) || 1,
      max_tokens: process.env.max_tokens ? +process.env.max_tokens : undefined,
      response_format: { type: "json_object" }
    });

    // Existing parsing logic...
    if (res.choices.length) {
      try {
        return JSON.parse(res.choices[0].message.content || "");
      } catch (e) {
        return {
          lgtm: false,
          review_comment: res.choices[0].message.content || ""
        };
      }
    }

    return { lgtm: true, review_comment: "" };
  }
}
```

### Option 2: Responses API Only (Simpler)

Migrate entirely to Responses API (requires OpenAI SDK v5+):

```typescript
public async codeReview(patch: string): Promise<{ lgtm: boolean, review_comment: string }> {
  const prompt = this.generatePrompt(patch);
  const model = process.env.MODEL || 'gpt-4o-mini';

  const res = await this.openai.responses.create({
    model: model,
    input: prompt,
    reasoning: {
      effort: process.env.REASONING_EFFORT || 'medium'
    },
    output_schema: {
      type: "object",
      properties: {
        lgtm: { type: "boolean" },
        review_comment: { type: "string" }
      },
      required: ["lgtm", "review_comment"]
    }
  });

  return res.output.value as { lgtm: boolean, review_comment: string };
}
```

## Environment Variables for Responses API

Add new environment variables to `.env.example`:

```bash
# Reasoning model settings (for GPT-5.1, GPT-5.1-Codex, GPT-5 Pro)
REASONING_EFFORT=medium  # none, minimal, low, medium, high
VERBOSITY=medium         # low, medium, high
```

### Reasoning Effort Levels

| Level | Speed | Accuracy | Cost | Best For |
|-------|-------|----------|------|----------|
| `none` | Fastest | Lowest | Cheapest | Simple PRs, quick feedback |
| `minimal` | Very Fast | Low | Very Cheap | Routine changes |
| `low` | Fast | Moderate | Cheap | Standard PRs |
| `medium` | Balanced | Good | Moderate | Most use cases (recommended) |
| `high` | Slow | Highest | Expensive | Critical security reviews |

## Migration Checklist

- [ ] Update OpenAI SDK to v5+ (supports Responses API)
- [ ] Implement `isReasoningModel()` detection
- [ ] Add `codeReviewWithResponsesAPI()` method
- [ ] Add `REASONING_EFFORT` environment variable
- [ ] Add `VERBOSITY` environment variable
- [ ] Update `.env.example` with new variables
- [ ] Update README.md with Responses API configuration
- [ ] Test with gpt-5.1 model
- [ ] Test backward compatibility with gpt-4o
- [ ] Update documentation

## Testing

### Test Case 1: GPT-5.1 with Responses API
```yaml
env:
  MODEL: gpt-5.1-codex
  REASONING_EFFORT: medium
  VERBOSITY: medium
```

### Test Case 2: GPT-4o with Chat Completions API
```yaml
env:
  MODEL: gpt-4o
  temperature: 0.7
  max_tokens: 10000
```

## Performance Impact

Based on OpenAI documentation, migrating to Responses API for GPT-5.1 provides:

- **30-50% reduction** in reasoning tokens (lower costs)
- **2x faster** on simple tasks with adaptive reasoning
- **Higher cache hit rates** (20-30% improvement)
- **Better quality** with chain of thought passing

## Backward Compatibility

The dual API approach (Option 1) maintains full backward compatibility:

- ✅ Existing models (GPT-4o, GPT-3.5, etc.) use Chat Completions API
- ✅ New models (GPT-5.1, GPT-5 Pro) use Responses API
- ✅ No breaking changes for existing users
- ✅ Gradual migration path

## Timeline Recommendation

1. **Phase 1** (Week 1): Implement dual API support
2. **Phase 2** (Week 2): Test with GPT-5.1 models
3. **Phase 3** (Week 3): Update documentation
4. **Phase 4** (Week 4): Release and monitor

## References

- [OpenAI Responses API Documentation](https://platform.openai.com/docs/guides/latest-model?lang=javascript&quickstart-panels=smart)
- [Migration Guide: Chat Completions → Responses API](https://platform.openai.com/docs/guides/latest-model?lang=javascript&quickstart-panels=smart#migrating-from-chat-completions-to-responses-api)
- [GPT-5.1 Reasoning Guide](https://platform.openai.com/docs/guides/reasoning)
- [API Comparison](https://platform.openai.com/docs/api-reference/responses)

## Support

If you encounter issues during migration:
1. Check OpenAI SDK version (requires v5+)
2. Verify API endpoint access (`/v1/responses`)
3. Review output_schema format
4. Test with `reasoning.effort: "none"` for debugging

## Current Workaround (Until Migration)

While the code migration is in progress, GPT-5.1 models **will work** with the Chat Completions API, but with:

- ⚠️ **No reasoning optimization** - Model will use default reasoning
- ⚠️ **Higher costs** - More reasoning tokens generated
- ⚠️ **Lower performance** - Missed caching opportunities
- ⚠️ **No adaptive reasoning** - Fixed reasoning effort

**Recommendation:** Wait for code migration before using GPT-5.1 in production, OR use GPT-4o/GPT-4o-mini which fully support Chat Completions API.

---

**Status:** 🚧 Migration Required
**Priority:** High (for GPT-5.1 support)
**Estimated Effort:** 4-8 hours
**Breaking Changes:** None (with dual API approach)
