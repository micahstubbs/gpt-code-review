# Testing

## Test Suite

| Test File | Covers | Key Scenarios |
|-----------|--------|---------------|
| `index.test.ts` | Bot initialization | Probot app loads without error |
| `review-analyzer.test.ts` | Severity analysis, quality scoring, auth | Pattern matching, score calculation, cache behavior, fail-secure defaults |
| `review-analyzer-issue21.test.ts` | Defensive defaults | Undefined arrays don't crash `analyzeReviewSeverity()` |
| `review-analyzer-issue23.test.ts` | Edge cases | Specific regression scenarios |
| `json-extraction.test.ts` | `extractJsonFromText()` | Direct parse, code block extraction, brace matching, error recovery |
| `chat-structured-output.test.ts` | Responses API path | Structured output schema handling |
| `chat-verbosity.test.ts` | Verbosity parameter | Model-specific verbosity constraints (e.g., codex only supports `medium`) |
| `review-formatter.test.ts` | Markdown formatting | Severity badges, collapsible details, model attribution |

## Running Tests

```bash
# All tests
yarn test

# Single file
yarn test -- --testPathPattern=json-extraction

# Watch mode
yarn test -- --watch
```

## Test Infrastructure

- **HTTP mocking:** `nock` intercepts OpenAI and GitHub API calls
- **Event simulation:** Probot test utilities create synthetic webhook payloads
- **Fixtures:** `test/fixtures/mock-cert.pem` for GitHub App authentication in tests
- **Module resolution:** `jest.config.cjs` maps `.js` imports to `.ts` source files via `moduleNameMapper`
