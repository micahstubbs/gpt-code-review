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
            severity: 'critical' as const,
            message: 'Potential SQL injection in api/query.ts:42',
          },
        ],
        details: 'The query concatenates user input directly into SQL.',
      };

      const formatted = formatReviewComment(reviewData);

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
          { severity: 'critical' as const, message: 'Security flaw' },
          { severity: 'warning' as const, message: 'Unused variable' },
          { severity: 'style' as const, message: 'Use const instead of let' },
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
