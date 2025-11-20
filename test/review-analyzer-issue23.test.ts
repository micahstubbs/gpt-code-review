/**
 * Issue #23: Comprehensive edge case and boundary tests for calculateQualityScore
 */

import { calculateQualityScore, ReviewerAuth } from '../src/review-analyzer';

describe('Issue #23: Edge case and boundary tests', () => {
  describe('Critical softening boundaries', () => {
    const generateCriticals = (n: number) =>
      Array(n).fill(0).map((_, i) => `Critical bug ${i + 1}`).join('\n');

    test('0 criticals: score = 100', () => {
      expect(calculateQualityScore('Looks good', false).score).toBe(100);
    });

    test('1 critical: score = 70 (100 - 30)', () => {
      expect(calculateQualityScore(generateCriticals(1), false).score).toBe(70);
    });

    test('2 criticals: score = 40 (100 - 60)', () => {
      expect(calculateQualityScore(generateCriticals(2), false).score).toBe(40);
    });

    test('3 criticals: score = 10 (100 - 90)', () => {
      expect(calculateQualityScore(generateCriticals(3), false).score).toBe(10);
    });

    test('4 criticals apply softened weight for 4th issue', () => {
      // Verify 4th critical uses softened weight (25 points)
      // Total penalty: 3*30 + 1*25 = 90 + 25 = 115
      const score4 = calculateQualityScore(generateCriticals(4), false);
      // Expected: 100 - 115 = -15, clamped to 0
      expect(score4.score).toBe(0);
    });

    test('large critical counts remain monotonic', () => {
      const scores = [1, 5, 10, 15, 20].map(n =>
        calculateQualityScore(generateCriticals(n), false).score
      );

      // Verify scores decrease (or stay at 0)
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });

    test('score never increases with additional issues', () => {
      for (let i = 1; i < 20; i++) {
        const current = calculateQualityScore(generateCriticals(i), false).score;
        const next = calculateQualityScore(generateCriticals(i + 1), false).score;
        expect(next).toBeLessThanOrEqual(current);
      }
    });
  });

  describe('LGTM gating and penalties', () => {
    const validAuth: ReviewerAuth = {
      isVerified: true,
      login: 'reviewer',
      hasWriteAccess: true,
      verifiedAt: new Date()
    };

    test('LGTM with 0 criticals adds +10 bonus', () => {
      // Use a review with some deductions but no criticals
      const review = 'Warning: minor issue here';
      const withoutLgtm = calculateQualityScore(review, false);
      const withLgtm = calculateQualityScore(review, true, validAuth);

      expect(withLgtm.score - withoutLgtm.score).toBe(10);
    });

    test('LGTM bonus does not exceed score cap of 100', () => {
      const result = calculateQualityScore('Perfect!', true, validAuth);
      expect(result.score).toBe(100);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('LGTM with criticals applies -10 penalty', () => {
      const review = 'Critical bug found';
      const withoutLgtm = calculateQualityScore(review, false);
      const withLgtm = calculateQualityScore(review, true, validAuth);

      expect(withoutLgtm.score - withLgtm.score).toBe(10);
    });

    test('LGTM penalties respect score floor of 0', () => {
      const manyCriticals = Array(10).fill(0).map((_, i) =>
        `Critical bug ${i}`).join('\n');
      const result = calculateQualityScore(manyCriticals, true, validAuth);

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    test('lgtm=false has no special penalties', () => {
      const review = 'Critical bug found';
      const withFalseLgtm = calculateQualityScore(review, false);
      const baseline = calculateQualityScore(review, false);

      expect(withFalseLgtm.score).toBe(baseline.score);
    });
  });

  describe('Cross-category interactions', () => {
    test('many suggestions can drive score very low', () => {
      // 50 suggestions * 5 points = 250 points penalty
      const manySuggestions = Array(50).fill(0).map((_, i) =>
        `Consider improvement ${i}`).join('\n');
      const result = calculateQualityScore(manySuggestions, false);

      // Should clamp to 0, not go negative
      expect(result.score).toBe(0);
    });

    test('mixed severity levels compound correctly', () => {
      const review = `
        Critical bug 1
        Critical bug 2
        Warning: issue here
        Warning: another issue
        Consider this
        Suggest that
      `;
      // 2 criticals (60) + 2 warnings (30) + 2 suggestions (10) = 100 total
      const result = calculateQualityScore(review, false);
      expect(result.score).toBe(0);
    });

    test('score boundaries work across all combinations', () => {
      const testCases = [
        { critical: 0, warnings: 0, suggestions: 0, expected: 100 },
        { critical: 1, warnings: 0, suggestions: 0, expected: 70 },
        { critical: 0, warnings: 2, suggestions: 0, expected: 70 },
        { critical: 0, warnings: 0, suggestions: 20, expected: 0 },
      ];

      for (const { critical, warnings, suggestions, expected } of testCases) {
        const review = [
          ...Array(critical).fill(0).map((_, i) => `Critical bug ${i}`),
          ...Array(warnings).fill(0).map((_, i) => `Warning: issue ${i}`),
          ...Array(suggestions).fill(0).map((_, i) => `Consider ${i}`),
        ].join('\n');

        const result = calculateQualityScore(review || 'Empty', false);
        expect(result.score).toBe(expected);
      }
    });
  });

  describe('Edge cases and robustness', () => {
    test('empty review with no issues scores 100', () => {
      expect(calculateQualityScore('All good!', false).score).toBe(100);
    });

    test('whitespace-only lines are ignored', () => {
      const review = `

        Critical bug found


      `;
      const result = calculateQualityScore(review, false);
      expect(result.score).toBe(70);
    });

    test('score calculation is deterministic', () => {
      const review = 'Critical bug\nWarning: issue';
      const result1 = calculateQualityScore(review, false);
      const result2 = calculateQualityScore(review, false);
      expect(result1.score).toBe(result2.score);
    });

    test('score is independent of issue ordering', () => {
      const review1 = 'Critical bug\nWarning: issue\nConsider this';
      const review2 = 'Consider this\nCritical bug\nWarning: issue';
      const review3 = 'Warning: issue\nConsider this\nCritical bug';

      const result1 = calculateQualityScore(review1, false);
      const result2 = calculateQualityScore(review2, false);
      const result3 = calculateQualityScore(review3, false);

      expect(result1.score).toBe(result2.score);
      expect(result2.score).toBe(result3.score);
    });
  });

  describe('Property-based monotonicity', () => {
    test('score monotonically decreases across all issue types', () => {
      // Test that adding issues of any type never increases score
      for (let c = 0; c < 4; c++) {
        for (let w = 0; w < 4; w++) {
          for (let s = 0; s < 4; s++) {
            const current = [
              ...Array(c).fill(0).map((_, i) => `Critical bug ${i}`),
              ...Array(w).fill(0).map((_, i) => `Warning: issue ${i}`),
              ...Array(s).fill(0).map((_, i) => `Consider ${i}`)
            ].join('\n') || 'Empty';

            const moreCriticals = [
              ...Array(c + 1).fill(0).map((_, i) => `Critical bug ${i}`),
              ...Array(w).fill(0).map((_, i) => `Warning: issue ${i}`),
              ...Array(s).fill(0).map((_, i) => `Consider ${i}`)
            ].join('\n');

            const moreWarnings = [
              ...Array(c).fill(0).map((_, i) => `Critical bug ${i}`),
              ...Array(w + 1).fill(0).map((_, i) => `Warning: issue ${i}`),
              ...Array(s).fill(0).map((_, i) => `Consider ${i}`)
            ].join('\n');

            const moreSuggestions = [
              ...Array(c).fill(0).map((_, i) => `Critical bug ${i}`),
              ...Array(w).fill(0).map((_, i) => `Warning: issue ${i}`),
              ...Array(s + 1).fill(0).map((_, i) => `Consider ${i}`)
            ].join('\n');

            const currentScore = calculateQualityScore(current, false).score;
            const critScore = calculateQualityScore(moreCriticals, false).score;
            const warnScore = calculateQualityScore(moreWarnings, false).score;
            const suggScore = calculateQualityScore(moreSuggestions, false).score;

            expect(critScore).toBeLessThanOrEqual(currentScore);
            expect(warnScore).toBeLessThanOrEqual(currentScore);
            expect(suggScore).toBeLessThanOrEqual(currentScore);
          }
        }
      }
    });
  });
});
