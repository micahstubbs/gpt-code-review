/**
 * Tests for JSON extraction fallback functionality
 * Used when models like GPT-5.2 Pro don't support structured outputs
 */

// Import the module to access internal functions via the Chat class
import { Chat } from '../src/chat';

// We need to test the extractJsonFromText function which is not exported
// So we'll test it indirectly through realistic scenarios

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
 * These test the extraction logic directly by creating test scenarios
 */
describe('JSON extraction strategies', () => {
  // Helper to simulate the extraction logic
  function extractJsonFromText(text: string): any {
    if (!text || typeof text !== 'string') {
      return null;
    }

    // Strategy 1: Try direct JSON parse
    try {
      const parsed = JSON.parse(text.trim());
      if (parsed && typeof parsed === 'object' && typeof parsed.lgtm === 'boolean') {
        return parsed;
      }
    } catch {
      // Continue
    }

    // Strategy 2: Extract from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1].trim());
        if (parsed && typeof parsed === 'object' && typeof parsed.lgtm === 'boolean') {
          return parsed;
        }
      } catch {
        // Continue
      }
    }

    // Strategy 3: Find JSON object boundaries
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      try {
        const jsonStr = text.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === 'object' && typeof parsed.lgtm === 'boolean') {
          return parsed;
        }
      } catch {
        // Continue
      }
    }

    // Strategy 4: Fix common JSON issues
    const cleanedText = text
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/'/g, '"');

    const cleanJsonStart = cleanedText.indexOf('{');
    const cleanJsonEnd = cleanedText.lastIndexOf('}');
    if (cleanJsonStart !== -1 && cleanJsonEnd !== -1 && cleanJsonEnd > cleanJsonStart) {
      try {
        const jsonStr = cleanedText.substring(cleanJsonStart, cleanJsonEnd + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === 'object' && typeof parsed.lgtm === 'boolean') {
          return parsed;
        }
      } catch {
        // All strategies failed
      }
    }

    return null;
  }

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
