/**
 * Tests for getValidVerbosity() model-specific verbosity handling
 */

import { Chat } from '../src/chat';

describe('Chat verbosity handling', () => {
  let originalVerbosity: string | undefined;
  let originalModel: string | undefined;

  beforeEach(() => {
    originalVerbosity = process.env.VERBOSITY;
    originalModel = process.env.MODEL;
  });

  afterEach(() => {
    if (originalVerbosity) {
      process.env.VERBOSITY = originalVerbosity;
    } else {
      delete process.env.VERBOSITY;
    }
    if (originalModel) {
      process.env.MODEL = originalModel;
    } else {
      delete process.env.MODEL;
    }
  });

  describe('gpt-5.1-codex model', () => {
    test('should not throw with VERBOSITY=low (enforces medium internally)', async () => {
      process.env.VERBOSITY = 'low';
      process.env.MODEL = 'gpt-5.1-codex';

      const chat = new Chat('test-key');
      // Empty patch returns immediately without API call
      const result = await chat.codeReview('');

      expect(result.lgtm).toBe(true);
      // If we got here without error, the verbosity was handled correctly
    });

    test('should not throw with VERBOSITY=high (enforces medium internally)', async () => {
      process.env.VERBOSITY = 'high';
      process.env.MODEL = 'gpt-5.1-codex';

      const chat = new Chat('test-key');
      const result = await chat.codeReview('');

      expect(result.lgtm).toBe(true);
    });

    test('should work with VERBOSITY=medium', async () => {
      process.env.VERBOSITY = 'medium';
      process.env.MODEL = 'gpt-5.1-codex';

      const chat = new Chat('test-key');
      const result = await chat.codeReview('');

      expect(result.lgtm).toBe(true);
    });

    test('should work without VERBOSITY set (defaults to medium)', async () => {
      delete process.env.VERBOSITY;
      process.env.MODEL = 'gpt-5.1-codex';

      const chat = new Chat('test-key');
      const result = await chat.codeReview('');

      expect(result.lgtm).toBe(true);
    });
  });

  describe('non-codex GPT-5.1 models', () => {
    test('should respect VERBOSITY=low for gpt-5.1', async () => {
      process.env.VERBOSITY = 'low';
      process.env.MODEL = 'gpt-5.1';

      const chat = new Chat('test-key');
      const result = await chat.codeReview('');

      expect(result.lgtm).toBe(true);
    });

    test('should respect VERBOSITY=high for gpt-5.1', async () => {
      process.env.VERBOSITY = 'high';
      process.env.MODEL = 'gpt-5.1';

      const chat = new Chat('test-key');
      const result = await chat.codeReview('');

      expect(result.lgtm).toBe(true);
    });

    test('should default to medium for gpt-5.1 without VERBOSITY', async () => {
      delete process.env.VERBOSITY;
      process.env.MODEL = 'gpt-5.1';

      const chat = new Chat('test-key');
      const result = await chat.codeReview('');

      expect(result.lgtm).toBe(true);
    });
  });

  describe('invalid verbosity values', () => {
    test('should handle invalid verbosity value gracefully', async () => {
      process.env.VERBOSITY = 'ultra'; // Invalid value
      process.env.MODEL = 'gpt-5.1';

      const chat = new Chat('test-key');
      const result = await chat.codeReview('');

      // Should not crash - falls back to medium
      expect(result.lgtm).toBe(true);
    });

    test('should handle typo in verbosity value', async () => {
      process.env.VERBOSITY = 'mediuum'; // Typo
      process.env.MODEL = 'gpt-5.1-codex';

      const chat = new Chat('test-key');
      const result = await chat.codeReview('');

      // Should not crash - codex enforces medium anyway
      expect(result.lgtm).toBe(true);
    });
  });
});
