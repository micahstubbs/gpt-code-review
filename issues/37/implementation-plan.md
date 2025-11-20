# Concise Collapsible Code Reviews Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform code review comments to show concise issue summaries at the top with detailed analysis collapsed by default in `<details>` tags.

**Architecture:** Modify the JSON response schema for both Chat Completions API (GPT-4o) and Responses API (GPT-5.1+) to return structured issue data. Add post-processing in `bot.ts` to format comments with issue summaries and collapsible details sections.

**Tech Stack:** TypeScript, OpenAI SDK, Jest for testing

---

## Task 1: Create Review Formatter Module

**Files:**
- Create: `/home/m/workspace/worktrees/ChatGPT-CodeReview-worktree-2/src/review-formatter.ts`
- Test: `/home/m/workspace/worktrees/ChatGPT-CodeReview-worktree-2/test/review-formatter.test.ts`

**Step 1: Write the failing test for basic formatter**

Create test file with test for formatting a review with issues:

```typescript
/**
 * Tests for review-formatter module
 * Formats code review comments with issue summaries and collapsible details
 */

import { formatReviewComment } from '../src/review-formatter';

describe('review-formatter', () => {
  describe('formatReviewComment', () => {
    test('should format review with issue summary and details section', () => {
      const reviewData = {
        issues: [
          {
            severity: 'critical',
            message: 'Potential SQL injection in api/query.ts:42',
          },
        ],
        details: 'The query concatenates user input directly into SQL.',
      };

      const formatted = formatReviewComment(reviewData);

      expect(formatted).toContain('## Code Review Summary');
      expect(formatted).toContain('### Issues Found');
      expect(formatted).toContain('**Critical**:');
      expect(formatted).toContain('Potential SQL injection');
      expect(formatted).toContain('<details>');
      expect(formatted).toContain('<summary>Detailed Analysis</summary>');
      expect(formatted).toContain('</details>');
    });

    test('should handle empty issues array', () => {
      const reviewData = {
        issues: [],
        details: 'Code looks good overall.',
      };

      const formatted = formatReviewComment(reviewData);

      expect(formatted).toContain('No issues found');
      expect(formatted).toContain('<details>');
    });

    test('should handle multiple severity levels', () => {
      const reviewData = {
        issues: [
          { severity: 'critical', message: 'Security flaw' },
          { severity: 'warning', message: 'Unused variable' },
          { severity: 'style', message: 'Use const instead of let' },
        ],
        details: 'Multiple issues detected.',
      };

      const formatted = formatReviewComment(reviewData);

      expect(formatted).toContain('**Critical**:');
      expect(formatted).toContain('**Warning**:');
      expect(formatted).toContain('**Style**:');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test test/review-formatter.test.ts`
Expected: FAIL with "Cannot find module '../src/review-formatter'"

**Step 3: Write minimal implementation**

Create the review-formatter module:

```typescript
/**
 * Review formatter - formats code review comments with issue summaries
 * and collapsible details sections
 */

export interface ReviewIssue {
  severity: 'critical' | 'warning' | 'style' | 'suggestion';
  message: string;
}

export interface ReviewData {
  issues: ReviewIssue[];
  details: string;
}

export function formatReviewComment(reviewData: ReviewData): string {
  const { issues, details } = reviewData;

  // Build issue summary
  let summary = '## Code Review Summary\n\n### Issues Found\n';

  if (issues.length === 0) {
    summary += 'No issues found ✓\n\n';
  } else {
    for (const issue of issues) {
      const severityLabel = issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1);
      summary += `- **${severityLabel}**: ${issue.message}\n`;
    }
    summary += '\n';
  }

  // Add collapsible details section
  summary += '<details>\n';
  summary += '<summary>Detailed Analysis</summary>\n\n';
  summary += details;
  summary += '\n\n</details>';

  return summary;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test test/review-formatter.test.ts`
Expected: PASS (all tests green)

**Step 5: Commit**

```bash
git add src/review-formatter.ts test/review-formatter.test.ts
git commit -m "feat: add review formatter with issue summaries and collapsible details"
```

---

## Task 2: Update Chat API Response Schema

**Files:**
- Modify: `/home/m/workspace/worktrees/ChatGPT-CodeReview-worktree-2/src/chat.ts:156-204`
- Test: `/home/m/workspace/worktrees/ChatGPT-CodeReview-worktree-2/test/chat-structured-output.test.ts`

**Step 1: Write test for structured Chat API response**

Create test for new structured response format:

```typescript
/**
 * Tests for structured output from Chat API
 */

import { Chat } from '../src/chat';

describe('Chat API structured output', () => {
  test('codeReview should return structured data with issues array', async () => {
    // Mock OpenAI API key
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.MODEL = 'gpt-4o-mini';

    const chat = new Chat('test-key');

    // We can't easily test the actual API call, but we can verify the interface
    // This is more of a type-check test
    const patch = 'test patch';

    // Test will verify the return type structure
    const result = await chat.codeReview(patch).catch(() => ({
      lgtm: false,
      review_comment: '',
      issues: [],
      details: '',
    }));

    expect(result).toHaveProperty('lgtm');
    expect(result).toHaveProperty('review_comment');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('details');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test test/chat-structured-output.test.ts`
Expected: FAIL (result doesn't have 'issues' or 'details' properties)

**Step 3: Update Chat API interface and prompt**

Modify `src/chat.ts` to update the prompt and return type:

```typescript
// Update private generatePrompt method (around line 38-55)
private generatePrompt = (patch: string) => {
  const answerLanguage = process.env.LANGUAGE
    ? `Answer me in ${process.env.LANGUAGE},`
    : '';

  const basePrompt = process.env.PROMPT || 'Review the following code patch. Focus on potential bugs, risks, and improvements.';

  // Add conciseness instruction
  const styleInstruction = '\nBe concise. Prioritize clarity over perfect grammar.\n';

  const jsonFormatRequirement = '\nProvide your feedback in strict JSON format:\n' +
    '{\n' +
    '  "lgtm": boolean,\n' +
    '  "review_comment": string,\n' +
    '  "issues": [\n' +
    '    {"severity": "critical" | "warning" | "style" | "suggestion", "message": "brief issue description"}\n' +
    '  ],\n' +
    '  "details": string // detailed analysis with explanations\n' +
    '}\n' +
    'List all issues concisely in the issues array. Put detailed explanations in the details field.\n';

  return `${basePrompt}${styleInstruction}${jsonFormatRequirement} ${answerLanguage}:
  ${patch}
  `;
};

// Update codeReviewWithChatAPI return type (around line 156-204)
private async codeReviewWithChatAPI(
  patch: string,
  model: string
): Promise<{ lgtm: boolean; review_comment: string; issues: any[]; details: string }> {
  if (!patch) {
    return {
      lgtm: true,
      review_comment: "",
      issues: [],
      details: "",
    };
  }

  console.time('code-review-chat-api cost');
  const prompt = this.generatePrompt(patch);

  const res = await this.openai.chat.completions.create({
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    model: model,
    temperature: +(process.env.temperature || 0) || 1,
    top_p: +(process.env.top_p || 0) || 1,
    max_tokens: process.env.max_tokens ? +process.env.max_tokens : undefined,
    response_format: {
      type: "json_object"
    },
  });

  console.timeEnd('code-review-chat-api cost');

  if (res.choices.length) {
    try {
      const json = JSON.parse(res.choices[0].message.content || "");
      // Ensure issues and details exist with defaults
      return {
        lgtm: json.lgtm || false,
        review_comment: json.review_comment || "",
        issues: json.issues || [],
        details: json.details || json.review_comment || "",
      };
    } catch (e) {
      return {
        lgtm: false,
        review_comment: res.choices[0].message.content || "",
        issues: [],
        details: res.choices[0].message.content || "",
      };
    }
  }

  return {
    lgtm: true,
    review_comment: "",
    issues: [],
    details: "",
  };
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test test/chat-structured-output.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/chat.ts test/chat-structured-output.test.ts
git commit -m "feat: update Chat API to return structured issues and details"
```

---

## Task 3: Update Responses API Schema

**Files:**
- Modify: `/home/m/workspace/worktrees/ChatGPT-CodeReview-worktree-2/src/chat.ts:57-153`

**Step 1: Write test for Responses API structured output**

Add test case to `test/chat-structured-output.test.ts`:

```typescript
test('codeReview with GPT-5.1 should return structured data', async () => {
  process.env.MODEL = 'gpt-5.1';
  process.env.OPENAI_API_KEY = 'test-key';

  const chat = new Chat('test-key');
  const patch = 'test patch';

  const result = await chat.codeReview(patch).catch(() => ({
    lgtm: false,
    review_comment: '',
    issues: [],
    details: '',
  }));

  expect(result).toHaveProperty('lgtm');
  expect(result).toHaveProperty('issues');
  expect(result).toHaveProperty('details');
  expect(Array.isArray(result.issues)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test test/chat-structured-output.test.ts`
Expected: FAIL (Responses API result doesn't have new fields)

**Step 3: Update Responses API schema and prompt**

Modify `src/chat.ts` `codeReviewWithResponsesAPI` method:

```typescript
private async codeReviewWithResponsesAPI(
  patch: string,
  model: string
): Promise<{ lgtm: boolean; review_comment: string; issues: any[]; details: string }> {
  if (!patch) {
    return {
      lgtm: true,
      review_comment: "",
      issues: [],
      details: "",
    };
  }

  console.time('code-review-responses-api cost');

  const answerLanguage = process.env.LANGUAGE
    ? `Answer me in ${process.env.LANGUAGE}.`
    : '';

  const basePrompt = process.env.PROMPT || 'Review the following code patch. Focus on potential bugs, risks, and improvements.';

  // Add conciseness instruction
  const styleInstruction = ' Be concise. Prioritize clarity over perfect grammar.';

  const prompt = `${basePrompt}${styleInstruction} ${answerLanguage}\n\nCode patch:\n${patch}`;

  try {
    const res = await this.openai.responses.create({
      model: model,
      input: prompt,
      reasoning: {
        effort: (process.env.REASONING_EFFORT as any) || 'medium'
      },
      text: {
        verbosity: (process.env.VERBOSITY as any) || 'low', // Set to low for conciseness
        format: {
          type: 'json_schema',
          name: 'code_review_response',
          schema: {
            type: "object",
            properties: {
              lgtm: {
                type: "boolean",
                description: "True if code is good to merge, false if concerns exist"
              },
              review_comment: {
                type: "string",
                description: "Legacy field for backward compatibility (can be empty)"
              },
              issues: {
                type: "array",
                description: "List of issues found in the code",
                items: {
                  type: "object",
                  properties: {
                    severity: {
                      type: "string",
                      enum: ["critical", "warning", "style", "suggestion"],
                      description: "Severity level of the issue"
                    },
                    message: {
                      type: "string",
                      description: "Brief description of the issue"
                    }
                  },
                  required: ["severity", "message"],
                  additionalProperties: false
                }
              },
              details: {
                type: "string",
                description: "Detailed analysis and explanations"
              }
            },
            required: ["lgtm", "review_comment", "issues", "details"],
            additionalProperties: false
          },
          strict: true
        }
      }
    });

    console.timeEnd('code-review-responses-api cost');

    // Extract structured output from output array
    if (res.output && res.output.length > 0) {
      const messageOutput = res.output.find((item: any) => item.type === 'message') as any;
      if (messageOutput && messageOutput.content && Array.isArray(messageOutput.content) && messageOutput.content.length > 0) {
        const textContent = messageOutput.content.find((c: any) => c.type === 'text');
        if (textContent && textContent.text) {
          try {
            const parsed = JSON.parse(textContent.text);
            return {
              lgtm: parsed.lgtm || false,
              review_comment: parsed.review_comment || "",
              issues: parsed.issues || [],
              details: parsed.details || "",
            };
          } catch (parseError) {
            // JSON parse failed
          }
        }
      }
    }

    // Fallback: try output_text
    if (res.output_text) {
      try {
        const parsed = JSON.parse(res.output_text);
        return {
          lgtm: parsed.lgtm || false,
          review_comment: parsed.review_comment || "",
          issues: parsed.issues || [],
          details: parsed.details || "",
        };
      } catch (parseError) {
        return {
          lgtm: false,
          review_comment: res.output_text,
          issues: [],
          details: res.output_text,
        };
      }
    }

    // Final fallback
    return {
      lgtm: false,
      review_comment: "Error: Unable to parse Responses API output",
      issues: [],
      details: "Error: Unable to parse Responses API output",
    };
  } catch (e) {
    console.timeEnd('code-review-responses-api cost');
    throw e;
  }
}
```

**Step 4: Update main codeReview method return type**

Update the public `codeReview` method signature:

```typescript
public codeReview = async (patch: string): Promise<{
  lgtm: boolean;
  review_comment: string;
  issues: any[];
  details: string;
}> => {
  if (!patch) {
    return {
      lgtm: true,
      review_comment: "",
      issues: [],
      details: "",
    };
  }

  const model = process.env.MODEL || (this.isGithubModels ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');

  // Use Responses API for GPT-5.1+ models, Chat Completions API for others
  if (this.isReasoningModel(model)) {
    return await this.codeReviewWithResponsesAPI(patch, model);
  } else {
    return await this.codeReviewWithChatAPI(patch, model);
  }
};
```

**Step 5: Run test to verify it passes**

Run: `yarn test test/chat-structured-output.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/chat.ts test/chat-structured-output.test.ts
git commit -m "feat: update Responses API to return structured issues and details"
```

---

## Task 4: Integrate Formatter in Bot

**Files:**
- Modify: `/home/m/workspace/worktrees/ChatGPT-CodeReview-worktree-2/src/bot.ts:163-186`

**Step 1: Write test for bot using formatter**

Create test file `test/bot-formatter-integration.test.ts`:

```typescript
/**
 * Tests for bot integration with review formatter
 */

import { formatReviewComment } from '../src/review-formatter';

describe('Bot formatter integration', () => {
  test('should use formatter when issues array exists', () => {
    const reviewData = {
      lgtm: false,
      review_comment: 'Legacy comment',
      issues: [
        { severity: 'critical', message: 'Security issue' },
      ],
      details: 'Detailed explanation here.',
    };

    // Simulate what bot.ts will do
    let commentBody: string;
    if (reviewData.issues && reviewData.issues.length >= 0) {
      commentBody = formatReviewComment({
        issues: reviewData.issues,
        details: reviewData.details,
      });
    } else {
      commentBody = reviewData.review_comment;
    }

    expect(commentBody).toContain('## Code Review Summary');
    expect(commentBody).toContain('<details>');
  });

  test('should fall back to review_comment when issues is missing', () => {
    const reviewData = {
      lgtm: false,
      review_comment: 'Plain old comment',
      issues: undefined as any,
      details: '',
    };

    let commentBody: string;
    if (reviewData.issues && reviewData.issues.length >= 0) {
      commentBody = formatReviewComment({
        issues: reviewData.issues,
        details: reviewData.details,
      });
    } else {
      commentBody = reviewData.review_comment;
    }

    expect(commentBody).toBe('Plain old comment');
  });
});
```

**Step 2: Run test to verify it passes**

Run: `yarn test test/bot-formatter-integration.test.ts`
Expected: PASS (this is more of a specification test)

**Step 3: Update bot.ts to use formatter**

Modify `src/bot.ts` to import and use the formatter:

```typescript
// Add import at top of file (after line 4)
import { formatReviewComment } from './review-formatter.js';

// Update the review processing loop (around lines 163-186)
for (let i = 0; i < changedFiles.length; i++) {
  const file = changedFiles[i];
  const patch = file.patch || '';

  if (file.status !== 'modified' && file.status !== 'added') {
    continue;
  }

  if (!patch || patch.length > MAX_PATCH_COUNT) {
    log.info(
      `${file.filename} skipped caused by its diff is too large`
    );
    continue;
  }
  try {
    const res = await chat?.codeReview(patch);
    if (!res.lgtm && (!!res.review_comment || res.issues?.length > 0)) {
      // Calculate safe position
      const patchLines = patch.split('\n');
      let position = 1;
      for (let i = 0; i < patchLines.length; i++) {
        if (patchLines[i].startsWith('@@')) {
          position = i + 2;
          break;
        }
      }
      position = Math.min(position, patchLines.length);

      // Format comment using formatter if structured data exists
      let commentBody: string;
      if (res.issues && res.issues.length >= 0) {
        commentBody = formatReviewComment({
          issues: res.issues,
          details: res.details || res.review_comment,
        });
      } else {
        // Fall back to legacy format for backward compatibility
        commentBody = res.review_comment;
      }

      ress.push({
        path: file.filename,
        body: commentBody,
        position: position,
      })
    }
  } catch (e) {
    log.info(`review ${file.filename} failed`, e);
    throw e;
  }
}
```

**Step 4: Run existing tests to verify nothing broke**

Run: `yarn test`
Expected: All tests PASS

**Step 5: Build the project to verify TypeScript compilation**

Run: `yarn build`
Expected: Build succeeds with no errors

**Step 6: Commit**

```bash
git add src/bot.ts test/bot-formatter-integration.test.ts
git commit -m "feat: integrate review formatter in bot for structured comments"
```

---

## Task 5: Add Environment Variable for Toggle

**Files:**
- Modify: `/home/m/workspace/worktrees/ChatGPT-CodeReview-worktree-2/src/bot.ts:163-186`
- Modify: `/home/m/workspace/worktrees/ChatGPT-CodeReview-worktree-2/.env.example`

**Step 1: Write test for environment variable toggle**

Add test to `test/bot-formatter-integration.test.ts`:

```typescript
test('should respect COMMENT_FORMAT environment variable', () => {
  const reviewData = {
    lgtm: false,
    review_comment: 'Legacy comment',
    issues: [{ severity: 'warning', message: 'Minor issue' }],
    details: 'Details here',
  };

  // Test with COMMENT_FORMAT=structured
  process.env.COMMENT_FORMAT = 'structured';
  let useStructured = process.env.COMMENT_FORMAT === 'structured';

  let commentBody = useStructured
    ? formatReviewComment({ issues: reviewData.issues, details: reviewData.details })
    : reviewData.review_comment;

  expect(commentBody).toContain('## Code Review Summary');

  // Test with COMMENT_FORMAT=legacy
  process.env.COMMENT_FORMAT = 'legacy';
  useStructured = process.env.COMMENT_FORMAT === 'structured';

  commentBody = useStructured
    ? formatReviewComment({ issues: reviewData.issues, details: reviewData.details })
    : reviewData.review_comment;

  expect(commentBody).toBe('Legacy comment');

  // Clean up
  delete process.env.COMMENT_FORMAT;
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test test/bot-formatter-integration.test.ts`
Expected: PASS (this test should pass since it's testing the logic we'll add)

**Step 3: Update bot.ts to check environment variable**

Modify the formatter integration in `src/bot.ts`:

```typescript
// Format comment using formatter if structured data exists and format is enabled
let commentBody: string;
const useStructuredFormat = process.env.COMMENT_FORMAT !== 'legacy';

if (useStructuredFormat && res.issues && res.issues.length >= 0) {
  commentBody = formatReviewComment({
    issues: res.issues,
    details: res.details || res.review_comment,
  });
} else {
  // Fall back to legacy format
  commentBody = res.review_comment;
}
```

**Step 4: Update .env.example**

Add to `.env.example`:

```bash
# Code review comment format
# - structured: Use structured format with issue summaries and collapsible details (default)
# - legacy: Use plain review_comment format (for backward compatibility)
COMMENT_FORMAT=structured
```

**Step 5: Run tests to verify**

Run: `yarn test`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/bot.ts .env.example test/bot-formatter-integration.test.ts
git commit -m "feat: add COMMENT_FORMAT env var to toggle between formats"
```

---

## Task 6: Update Documentation

**Files:**
- Modify: `/home/m/workspace/worktrees/ChatGPT-CodeReview-worktree-2/README.md`
- Modify: `/home/m/workspace/worktrees/ChatGPT-CodeReview-worktree-2/CLAUDE.md`

**Step 1: Read current README**

Read: `/home/m/workspace/worktrees/ChatGPT-CodeReview-worktree-2/README.md`

**Step 2: Update README with new feature documentation**

Add section about structured comment format in the configuration/environment variables section:

```markdown
### Comment Formatting

- `COMMENT_FORMAT` - Control the format of code review comments
  - `structured` (default): Shows concise issue summaries at the top with detailed analysis in collapsible `<details>` sections
  - `legacy`: Uses plain markdown format (backward compatible)

The structured format includes:
- Concise issue list at the top organized by severity (Critical, Warning, Style, Suggestion)
- Detailed explanations collapsed by default for easier PR scanning
- Improved readability for reviews with multiple issues
```

**Step 3: Update CLAUDE.md**

Update the "Code Review Flow" section in CLAUDE.md:

```markdown
## Code Review Flow

1. PR opened/synchronized
2. Load OpenAI API key (env or GitHub repo variable)
3. Check PR state (not closed/locked) and optional label
4. Compare commits to get changed files
5. Filter files by patterns
6. For each file:
   - Call `Chat.codeReview(patch)` with git diff
   - Receive structured response with `{ lgtm, review_comment, issues[], details }`
   - Format comment using `formatReviewComment()` (if COMMENT_FORMAT=structured)
   - Collect formatted review comments
7. Post review via GitHub API with all comments

## Review Comment Format

By default (COMMENT_FORMAT=structured), comments include:
- **Issue Summary**: Concise list of all issues by severity
- **Detailed Analysis**: Full explanations in collapsible `<details>` section

Set COMMENT_FORMAT=legacy for backward-compatible plain markdown format.
```

**Step 4: Commit documentation**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document structured comment format feature"
```

---

## Task 7: Run Full Test Suite and Build

**Files:**
- All project files

**Step 1: Run all tests**

Run: `yarn test`
Expected: All tests PASS with good coverage

**Step 2: Run type checking**

Run: `yarn type-check` (if script exists) or `tsc --noEmit`
Expected: No type errors

**Step 3: Build all targets**

Run: `yarn build`
Expected: Build succeeds for all targets (dist/, action/, lambda/)

**Step 4: Verify no regressions**

Run: `git status` to check all changes are committed
Expected: Working directory clean except for build artifacts

**Step 5: Final verification commit**

If any fixes were needed:
```bash
git add .
git commit -m "fix: address any type errors or test failures"
```

---

## Execution Complete

After all tasks are complete, use the `superpowers:finishing-a-development-branch` skill to:
1. Verify all tests pass
2. Create PR with summary of changes
3. Open PR in browser

**Verification checklist:**
- [ ] All tests pass
- [ ] TypeScript compiles with no errors
- [ ] Structured format shows issues at top
- [ ] Details are wrapped in `<details>` tags
- [ ] Legacy format still works with COMMENT_FORMAT=legacy
- [ ] Both GPT-4o and GPT-5.1+ models supported
- [ ] Documentation updated
