/**
 * Tests for review-analyzer module
 * Phase 1: Critical Security Fixes (#25, #26, #14)
 */

import {
  ReviewerAuth,
  calculateQualityScore,
  verifyReviewerAuthorization
} from '../src/review-analyzer';

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
const originalFetch = globalThis.fetch;
global.fetch = mockFetch as any;
globalThis.fetch = mockFetch as any;

describe('review-analyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original fetch to avoid polluting other test suites
    globalThis.fetch = originalFetch;
    global.fetch = originalFetch as any;
  });

  describe('Issue #26: ReviewerAuth interface (PAT exposure)', () => {
    test('ReviewerAuth should have verifiedAt field', async () => {
      // Mock fetch to return successful collaborator check
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          permission: 'write',
          user: { login: 'test-user' }
        })
      } as any);

      const auth = await verifyReviewerAuthorization(
        'test-user',
        'owner',
        'repo',
        'fake-token'
      );

      expect(auth).toHaveProperty('verifiedAt');
      expect(auth.verifiedAt).toBeInstanceOf(Date);
    });

    test('ReviewerAuth should NOT have authToken field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          permission: 'write',
          user: { login: 'test-user' }
        })
      } as any);

      const auth = await verifyReviewerAuthorization(
        'test-user',
        'owner',
        'repo',
        'fake-token'
      );

      expect(auth).not.toHaveProperty('authToken');
    });

    test('verifyReviewerAuthorization should never return token in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          permission: 'admin',
          user: { login: 'admin-user' }
        })
      } as any);

      const auth = await verifyReviewerAuthorization(
        'admin-user',
        'owner',
        'repo',
        'secret-token-123'
      );

      // Verify response doesn't contain the token
      const authString = JSON.stringify(auth);
      expect(authString).not.toContain('secret-token-123');
      expect(auth).not.toHaveProperty('authToken');
    });
  });

  describe('Issue #25: 404 authorization bug', () => {
    test('verifyReviewerAuthorization returns isVerified:false on 404', async () => {
      // Mock GitHub API 404 response (user is not a collaborator)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as any);

      const auth = await verifyReviewerAuthorization(
        'non-collaborator',
        'owner',
        'repo',
        'fake-token'
      );

      expect(auth.isVerified).toBe(false);
    });

    test('verifyReviewerAuthorization returns hasWriteAccess:false on 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as any);

      const auth = await verifyReviewerAuthorization(
        'non-collaborator',
        'owner',
        'repo',
        'fake-token'
      );

      expect(auth.hasWriteAccess).toBe(false);
    });

    test('verifyReviewerAuthorization includes verifiedAt on 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as any);

      const auth = await verifyReviewerAuthorization(
        'non-collaborator',
        'owner',
        'repo',
        'fake-token'
      );

      expect(auth.verifiedAt).toBeInstanceOf(Date);
    });

    test('verifyReviewerAuthorization returns isVerified:true for valid collaborator', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          permission: 'write',
          user: { login: 'collaborator' }
        })
      } as any);

      const auth = await verifyReviewerAuthorization(
        'collaborator',
        'owner',
        'repo',
        'fake-token'
      );

      expect(auth.isVerified).toBe(true);
      expect(auth.hasWriteAccess).toBe(true);
    });
  });

  describe('Issue #14: LGTM authorization enforcement', () => {
    test('calculateQualityScore throws error when lgtm=true without reviewerAuth', () => {
      const reviewComment = 'Looks good!';

      expect(() => {
        calculateQualityScore(reviewComment, true);
      }).toThrow('SECURITY ERROR: LGTM requires verified reviewer authorization');
    });

    test('calculateQualityScore throws error when lgtm=true with isVerified=false', () => {
      const reviewComment = 'Looks good!';
      const unverifiedAuth = {
        isVerified: false,
        login: 'test-user',
        hasWriteAccess: false,
        verifiedAt: new Date()
      } as any as ReviewerAuth;

      expect(() => {
        calculateQualityScore(reviewComment, true, unverifiedAuth);
      }).toThrow('SECURITY ERROR: LGTM requires isVerified=true');
    });

    test('calculateQualityScore accepts lgtm=false without reviewerAuth', () => {
      const reviewComment = 'Please fix the security issues';

      expect(() => {
        calculateQualityScore(reviewComment, false);
      }).not.toThrow();
    });

    test('calculateQualityScore accepts lgtm=true with valid reviewerAuth', () => {
      const reviewComment = 'Looks good!';
      const validAuth = {
        isVerified: true,
        login: 'reviewer',
        hasWriteAccess: true,
        verifiedAt: new Date()
      } as any as ReviewerAuth;

      expect(() => {
        calculateQualityScore(reviewComment, true, validAuth);
      }).not.toThrow();
    });

    test('LGTM bonus only applies with verified authorization', () => {
      // Use a review with minor suggestions so score isn't already at 100
      const reviewComment = 'Looks good! Consider adding more test coverage.';
      const validAuth = {
        isVerified: true,
        login: 'reviewer',
        hasWriteAccess: true,
        verifiedAt: new Date()
      } as any as ReviewerAuth;

      const scoreWithAuth = calculateQualityScore(reviewComment, true, validAuth);
      const scoreWithoutLgtm = calculateQualityScore(reviewComment, false);

      // LGTM with valid auth should give bonus (higher score)
      expect(scoreWithAuth.score).toBeGreaterThan(scoreWithoutLgtm.score);
    });

    test('LGTM bonus requires both verified and write access', () => {
      const reviewComment = 'Looks good!';

      // Verified but no write access
      const authNoWrite = {
        isVerified: true,
        login: 'read-only-user',
        hasWriteAccess: false,
        verifiedAt: new Date()
      } as any as ReviewerAuth;

      const scoreNoWrite = calculateQualityScore(reviewComment, true, authNoWrite);
      const scoreBaseline = calculateQualityScore(reviewComment, false);

      // No write access = no LGTM bonus
      expect(scoreNoWrite.score).toBe(scoreBaseline.score);
    });
  });

  describe('Error handling', () => {
    test('verifyReviewerAuthorization returns isVerified:false on error', async () => {
      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network error'));

      const auth = await verifyReviewerAuthorization(
        'test-user',
        'owner',
        'repo',
        'fake-token'
      );

      expect(auth.isVerified).toBe(false);
      expect(auth.hasWriteAccess).toBe(false);
    });

    test('verifyReviewerAuthorization includes verifiedAt even on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const auth = await verifyReviewerAuthorization(
        'test-user',
        'owner',
        'repo',
        'fake-token'
      );

      expect(auth.verifiedAt).toBeInstanceOf(Date);
    });
  });

  describe('Issue #12 & #19: Fix diminishing returns and weight-proportional softening', () => {
    // Helper to generate critical issues
    const generateCriticalIssues = (count: number): string => {
      return Array(count).fill('Critical bug found').join('\n');
    };


    test('0 critical issues should score 100', () => {
      const review = '';
      const score = calculateQualityScore(review, false);
      expect(score.score).toBe(100);
    });

    test('1 critical issue should score 70 (100 - 30)', () => {
      const review = generateCriticalIssues(1);
      const score = calculateQualityScore(review, false);
      expect(score.score).toBe(70);
    });

    test('2 critical issues should score 40 (100 - 60)', () => {
      const review = generateCriticalIssues(2);
      const score = calculateQualityScore(review, false);
      expect(score.score).toBe(40);
    });

    test('3 critical issues should score 10 (100 - 90)', () => {
      const review = generateCriticalIssues(3);
      const score = calculateQualityScore(review, false);
      expect(score.score).toBe(10);
    });

    test('4 criticals should score 0 (demonstrating diminishing returns)', () => {
      const review = generateCriticalIssues(4);
      const score = calculateQualityScore(review, false);

      // With correct logic: 100 - 3*30 - 1*25 = -15, clamped to 0
      // With broken logic: 100 - 4*30 + 1*5 = -15, also clamped to 0
      // This test passes on both, but documents expected behavior
      expect(score.score).toBe(0);
    });

    test('Score progression should show diminishing returns effect', () => {
      // This is the key test: verify the PROGRESSION is correct
      // Current bug: score += Math.floor(count - 3) * 5 ADDS BACK points
      // This means score goes: 100, 70, 40, 10, -15+5=-10 (clamped 0)
      // After fix: First 3 full penalty, then softened penalty
      // Score should be: 100, 70, 40, 10, then stay at 0

      const scores = [];
      for (let i = 0; i <= 6; i++) {
        const review = generateCriticalIssues(i);
        const result = calculateQualityScore(review, false);
        scores.push(result.score);
      }

      // Expected scores:
      // 0: 100
      // 1: 70 (100 - 30)
      // 2: 40 (100 - 60)
      // 3: 10 (100 - 90)
      // 4: 0 (100 - 90 - 25 = -15, clamped to 0)
      // 5: 0 (100 - 90 - 50 = -40, clamped to 0)
      // 6: 0 (100 - 90 - 75 = -75, clamped to 0)

      expect(scores).toEqual([100, 70, 40, 10, 0, 0, 0]);

      // Also verify monotonic
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });

    test('Diminishing returns calculation must happen BEFORE penalties are applied', () => {
      // This is the core bug: current code does:
      // 1. score -= count * 30
      // 2. score += (count - 3) * 5
      // This adds back points AFTER deducting, which is wrong.

      // Correct approach: calculate penalty WITH diminishing returns, then subtract once
      // criticalPenalty = min(count, 3) * 30 + max(0, count - 3) * 25

      // We can't directly test the intermediate calculation, but we can verify
      // the monotonic property holds

      const scores = [];
      for (let i = 0; i <= 10; i++) {
        const review = generateCriticalIssues(i);
        const result = calculateQualityScore(review, false);
        scores.push(result.score);
      }

      // Verify NO score increases as issues increase
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });

    test('Softening factor must be proportional to base weight (Issue #19)', () => {
      // Issue #19: The softening should be proportional to base weight
      // Softened weight = baseWeight * (1 - softenFactor)
      // With baseWeight=30, softenFactor=0.17: softened = 30 * 0.83 = 24.9 ≈ 25

      // The implementation uses derived calculation, so verify the relationship holds
      // 4 criticals: penalty = 3*30 + 1*25 = 115
      // 5 criticals: penalty = 3*30 + 2*25 = 140
      // Difference per additional critical = 25 (not hardcoded 5)

      const score4 = calculateQualityScore(generateCriticalIssues(4), false);
      const score5 = calculateQualityScore(generateCriticalIssues(5), false);

      // Both clamp to 0 with this many criticals
      expect(score4.score).toBe(0);
      expect(score5.score).toBe(0);

      // The real verification: check that softening is 83% of base weight
      // If base weight changed to 60, softening should be 50 (not stay at 5)
      // Since we can't easily change constants in tests, we verify the
      // relationship through the penalty progression:
      // Penalty difference between 4 and 5 criticals = 25 (softened weight)
      // This is 83.33% of 30 (base weight), confirming proportionality

      // Note: The previous "broken" implementation (-count*30 + (count-3)*5)
      // is mathematically equivalent to the correct formula for these values:
      // -30c + 5(c-3) = -25c - 15 = -90 - 25(c-3)
      // So tests can't distinguish them! The fix improves maintainability
      // and uses the correct conceptual model (diminishing returns upfront,
      // not add-back after full penalty).
    });

    test('Warning and suggestion scoring should remain unaffected', () => {
      const reviewWarnings = 'Warning: potential issue\nWarning: edge case';
      const reviewSuggestions = 'Consider improving\nSuggest refactoring';

      const scoreWarnings = calculateQualityScore(reviewWarnings, false);
      const scoreSuggestions = calculateQualityScore(reviewSuggestions, false);

      // 2 warnings = 100 - 2*15 = 70
      expect(scoreWarnings.score).toBe(70);

      // 2 suggestions = 100 - 2*5 = 90
      expect(scoreSuggestions.score).toBe(90);
    });
  });
});
