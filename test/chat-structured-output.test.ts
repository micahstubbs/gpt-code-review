/**
 * Tests for structured output from Chat API
 */

import { Chat } from '../src/chat';

describe('Chat API structured output', () => {
  test('codeReview should return structured data with issues array', async () => {
    // Test that the return type includes the new fields
    // This is mainly a TypeScript compile-time check
    const chat = new Chat('test-key');

    // Test with empty patch (should return immediately)
    const result = await chat.codeReview('');

    expect(result).toHaveProperty('lgtm');
    expect(result).toHaveProperty('review_comment');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('details');
    expect(Array.isArray(result.issues)).toBe(true);
    expect(typeof result.details).toBe('string');
  });

  test('codeReview with empty patch should have default structured values', async () => {
    const chat = new Chat('test-key');
    const result = await chat.codeReview('');

    expect(result.lgtm).toBe(true);
    expect(result.review_comment).toBe('');
    expect(result.issues).toEqual([]);
    expect(result.details).toBe('');
  });

  test('codeReview with GPT-5.1 should return structured data', async () => {
    // Set model to use Responses API
    const originalModel = process.env.MODEL;
    process.env.MODEL = 'gpt-5.1';

    const chat = new Chat('test-key');

    // Test with empty patch (should return immediately)
    const result = await chat.codeReview('');

    expect(result).toHaveProperty('lgtm');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('details');
    expect(Array.isArray(result.issues)).toBe(true);

    // Restore original model
    if (originalModel) {
      process.env.MODEL = originalModel;
    } else {
      delete process.env.MODEL;
    }
  });
});
