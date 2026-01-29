# OpenAI Integration

The bot supports two OpenAI API families and three code paths, chosen automatically based on model name. All logic lives in `src/chat.ts`.

## API Routing

```
codeReview(patch)
    │
    ├─ isReasoningModel()?  ──no──→  codeReviewWithChatAPI()
    │                                 (Chat Completions: /v1/chat/completions)
    │
    yes
    │
    ├─ supportsStructuredOutputs()?  ──no──→  codeReviewWithResponsesAPINoSchema()
    │                                          (Responses API without JSON schema)
    │
    yes
    │
    └─ codeReviewWithResponsesAPI()
       (Responses API with structured output schema)
```

### Model Classification

| Model | API | Structured Outputs |
|-------|-----|-------------------|
| `gpt-5.2-2025-12-11` | Responses | Yes |
| `gpt-5.2-pro-2025-12-11` | Responses | **No** (uses JSON extraction) |
| `gpt-5.1` | Responses | Yes |
| `gpt-5.1-codex` | Responses | Yes |
| `gpt-5.1-codex-mini` | Responses | Yes |
| `gpt-5.1-codex-max` | Responses | Yes |
| `gpt-4o` | Chat Completions | N/A |
| `gpt-4o-mini` | Chat Completions | N/A |
| `gpt-3.5-turbo` | Chat Completions | N/A |

## Path A: Responses API with Structured Outputs

Used by most GPT-5.x models. Sends a JSON schema definition to the API so the response is guaranteed to match the expected structure.

**Key parameters:**
- `reasoning.effort` -- Controls chain-of-thought depth (none/minimal/low/medium/high). Set via `REASONING_EFFORT` env var.
- `text.verbosity` -- Response length (low/medium/high). Set via `VERBOSITY` env var. Note: `gpt-5.1-codex` only supports `medium`.

**Streaming:** Enabled. The bot logs progress every 2 seconds during streaming and tracks character count.

**Response extraction:** Parsed from `output[0].content[0].text` in the structured response.

## Path B: Responses API without Schema

Used exclusively by `gpt-5.2-pro-2025-12-11`, which does not support structured output schemas. The prompt includes an explicit JSON format instruction, and the response is parsed using a multi-strategy JSON extractor:

1. Direct `JSON.parse()` on full text
2. Extract from markdown code blocks (` ```json ... ``` `)
3. Find JSON object boundaries (`{ ... }`)
4. Fix common issues (trailing commas, single quotes) and retry

## Path C: Chat Completions API

Used by legacy models (gpt-4o, gpt-4o-mini, gpt-3.5-turbo). Sends a standard chat completion request with `response_format: { type: 'json_object' }`.

**Parameters:** `temperature`, `top_p`, `max_tokens` (all from env vars).

**No streaming** -- single request/response.

## Response Format

All three paths normalize to the same structure:

```json
{
  "lgtm": true,
  "review_comment": "Formatted markdown comment",
  "issues": [
    { "severity": "critical", "message": "SQL injection in query builder" }
  ],
  "details": "Detailed analysis text"
}
```

The `review_comment` is formatted by `review-formatter.ts` into markdown with severity badges, collapsible details, and model attribution.

## Provider Support

The `Chat` constructor detects three provider configurations:

| Provider | Detection | Client |
|----------|-----------|--------|
| Azure OpenAI | `AZURE_API_VERSION` + `AZURE_DEPLOYMENT` set | `AzureOpenAI` |
| GitHub Models | `USE_GITHUB_MODELS=true` | `OpenAI` with `baseURL: https://models.inference.ai.azure.com` |
| OpenAI (default) | Neither above | `OpenAI` |
