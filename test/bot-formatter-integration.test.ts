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
        { severity: 'critical' as const, message: 'Security issue' },
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
