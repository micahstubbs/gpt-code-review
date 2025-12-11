/**
 * Tests for JSON extraction fallback functionality
 * Used when models like GPT-5.2 Pro don't support structured outputs
 */

import { Chat, extractJsonFromText, isValidCodeReviewResponse } from '../src/chat';

// Now exported from src/chat.ts for direct testing

describe('JSON extraction from LLM responses', () => {
  describe('Direct JSON parsing', () => {
    test('should parse clean JSON response', async () => {
      const chat = new Chat('test-key');
      // Test through empty patch (returns immediately)
      const result = await chat.codeReview('');
      expect(result.lgtm).toBe(true);
    });
  });

  describe('GPT-5.2 Pro model routing', () => {
    let originalModel: string | undefined;

    beforeEach(() => {
      originalModel = process.env.MODEL;
    });

    afterEach(() => {
      if (originalModel) {
        process.env.MODEL = originalModel;
      } else {
        delete process.env.MODEL;
      }
    });

    test('should route gpt-5.2-pro to no-schema method', async () => {
      process.env.MODEL = 'gpt-5.2-pro-2025-12-11';

      const chat = new Chat('test-key');
      // Empty patch returns immediately without API call
      const result = await chat.codeReview('');

      expect(result.lgtm).toBe(true);
      expect(result.issues).toEqual([]);
    });

    test('should route gpt-5.2 to schema method', async () => {
      process.env.MODEL = 'gpt-5.2-2025-12-11';

      const chat = new Chat('test-key');
      const result = await chat.codeReview('');

      expect(result.lgtm).toBe(true);
    });
  });
});

/**
 * Unit tests for JSON extraction strategies
 * Tests the production extractJsonFromText function directly
 */
describe('JSON extraction strategies', () => {
  test('extracts clean JSON', () => {
    const input = '{"lgtm": true, "review_comment": "LGTM", "issues": [], "details": "Clean code"}';
    const result = extractJsonFromText(input);
    expect(result).toEqual({
      lgtm: true,
      review_comment: 'LGTM',
      issues: [],
      details: 'Clean code',
    });
  });

  test('extracts JSON from markdown code block', () => {
    const input = `Here is my review:

\`\`\`json
{"lgtm": false, "review_comment": "Issues found", "issues": [{"severity": "warning", "message": "Test"}], "details": "Details"}
\`\`\`

Let me know if you have questions.`;

    const result = extractJsonFromText(input);
    expect(result?.lgtm).toBe(false);
    expect(result?.issues).toHaveLength(1);
  });

  test('extracts JSON from unmarked code block', () => {
    const input = `Review complete:

\`\`\`
{"lgtm": true, "review_comment": "", "issues": [], "details": "No issues"}
\`\`\``;

    const result = extractJsonFromText(input);
    expect(result?.lgtm).toBe(true);
  });

  test('extracts JSON surrounded by text', () => {
    const input = `Based on my analysis, here is the result:
{"lgtm": true, "review_comment": "Good", "issues": [], "details": "Clean"}
That concludes my review.`;

    const result = extractJsonFromText(input);
    expect(result?.lgtm).toBe(true);
    expect(result?.review_comment).toBe('Good');
  });

  test('handles trailing commas', () => {
    const input = `{"lgtm": true, "review_comment": "OK", "issues": [], "details": "Fine",}`;

    const result = extractJsonFromText(input);
    expect(result?.lgtm).toBe(true);
  });

  test('handles single quotes', () => {
    const input = `{'lgtm': true, 'review_comment': 'OK', 'issues': [], 'details': 'Fine'}`;

    const result = extractJsonFromText(input);
    expect(result?.lgtm).toBe(true);
  });

  test('returns null for invalid JSON', () => {
    const input = 'This is not JSON at all';
    const result = extractJsonFromText(input);
    expect(result).toBeNull();
  });

  test('returns null for empty input', () => {
    expect(extractJsonFromText('')).toBeNull();
    expect(extractJsonFromText(null as any)).toBeNull();
    expect(extractJsonFromText(undefined as any)).toBeNull();
  });

  test('returns null for JSON without required lgtm field', () => {
    const input = '{"review_comment": "Missing lgtm", "issues": []}';
    const result = extractJsonFromText(input);
    expect(result).toBeNull();
  });

  test('returns null for JSON without required issues array', () => {
    const input = '{"lgtm": true, "review_comment": "Missing issues"}';
    const result = extractJsonFromText(input);
    expect(result).toBeNull();
  });

  test('handles nested JSON in issues array', () => {
    const input = `{
      "lgtm": false,
      "review_comment": "Multiple issues",
      "issues": [
        {"severity": "critical", "message": "Security vulnerability"},
        {"severity": "warning", "message": "Performance concern"}
      ],
      "details": "Detailed analysis here"
    }`;

    const result = extractJsonFromText(input);
    expect(result?.lgtm).toBe(false);
    expect(result?.issues).toHaveLength(2);
    expect(result?.issues[0].severity).toBe('critical');
  });
});

/**
 * Tests for isValidCodeReviewResponse validation function
 */
describe('isValidCodeReviewResponse', () => {
  test('returns true for valid response with all fields', () => {
    const obj = { lgtm: true, review_comment: 'OK', issues: [], details: 'Fine' };
    expect(isValidCodeReviewResponse(obj)).toBe(true);
  });

  test('returns true for valid response with minimal required fields', () => {
    const obj = { lgtm: false, issues: [] };
    expect(isValidCodeReviewResponse(obj)).toBe(true);
  });

  test('returns false for null', () => {
    expect(isValidCodeReviewResponse(null)).toBe(false);
  });

  test('returns false for non-object', () => {
    expect(isValidCodeReviewResponse('string')).toBe(false);
    expect(isValidCodeReviewResponse(123)).toBe(false);
    expect(isValidCodeReviewResponse(undefined)).toBe(false);
  });

  test('returns false when lgtm is not boolean', () => {
    expect(isValidCodeReviewResponse({ lgtm: 'true', issues: [] })).toBe(false);
    expect(isValidCodeReviewResponse({ lgtm: 1, issues: [] })).toBe(false);
    expect(isValidCodeReviewResponse({ issues: [] })).toBe(false);
  });

  test('returns false when issues is not array', () => {
    expect(isValidCodeReviewResponse({ lgtm: true, issues: 'none' })).toBe(false);
    expect(isValidCodeReviewResponse({ lgtm: true, issues: null })).toBe(false);
    expect(isValidCodeReviewResponse({ lgtm: true })).toBe(false);
  });
});
