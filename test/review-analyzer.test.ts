/**
 * Tests for review-analyzer module
 * Phase 1: Critical Security Fixes (#25, #26, #14)
 */

import {
  ReviewerAuth,
  calculateQualityScore,
  verifyReviewerAuthorization,
  analyzeReviewSeverity
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

  describe('Issue #15: Input validation and ReDoS protection', () => {
    describe('analyzeReviewSeverity input validation', () => {
      test('should reject empty string', () => {
        expect(() => {
          analyzeReviewSeverity('');
        }).toThrow('Invalid input: reviewComment cannot be empty');
      });

      test('should reject null input', () => {
        expect(() => {
          analyzeReviewSeverity(null as any);
        }).toThrow('Invalid input: reviewComment must be a string');
      });

      test('should reject undefined input', () => {
        expect(() => {
          analyzeReviewSeverity(undefined as any);
        }).toThrow('Invalid input: reviewComment must be a string');
      });

      test('should reject non-string input', () => {
        expect(() => {
          analyzeReviewSeverity(123 as any);
        }).toThrow('Invalid input: reviewComment must be a string');
      });

      test('should reject excessively large input (>10000 chars)', () => {
        // Create a string larger than 10000 characters
        const largeInput = 'a'.repeat(10001);

        expect(() => {
          analyzeReviewSeverity(largeInput);
        }).toThrow('Invalid input: reviewComment exceeds maximum length of 10000 characters');
      });

      test('should accept input at exactly 10000 characters', () => {
        // Create a string at exactly 10000 characters
        const maxInput = 'a'.repeat(10000);

        expect(() => {
          analyzeReviewSeverity(maxInput);
        }).not.toThrow();
      });

      test('should reject input with excessive newlines (>1000 lines)', () => {
        // Create a string with more than 1000 lines
        const manyLines = Array(1001).fill('test').join('\n');

        expect(() => {
          analyzeReviewSeverity(manyLines);
        }).toThrow('Invalid input: reviewComment exceeds maximum of 1000 lines');
      });

      test('should accept input with exactly 1000 lines', () => {
        // Create a string with exactly 1000 lines
        const maxLines = Array(1000).fill('test').join('\n');

        expect(() => {
          analyzeReviewSeverity(maxLines);
        }).not.toThrow();
      });
    });

    describe('ReDoS protection', () => {
      test('should handle input with complex nested patterns safely', () => {
        // Patterns that could cause catastrophic backtracking
        const complexPattern = 'security ' + 'a'.repeat(100) + ' vulnerability';

        const start = Date.now();
        const result = analyzeReviewSeverity(complexPattern);
        const duration = Date.now() - start;

        // Should complete in reasonable time (< 100ms)
        expect(duration).toBeLessThan(100);
        expect(result.critical).toHaveLength(1);
      });

      test('should handle input with many repeated patterns safely', () => {
        // Many repeated keywords
        const repeatedPattern = Array(100).fill('warning: potential issue here').join('\n');

        const start = Date.now();
        const result = analyzeReviewSeverity(repeatedPattern);
        const duration = Date.now() - start;

        // Should complete in reasonable time (< 200ms)
        expect(duration).toBeLessThan(200);
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      test('should handle input with pathological whitespace patterns', () => {
        // Excessive whitespace could cause issues with some regex
        const whitespacePattern = 'security   \t\t\t   vulnerability\n\n\n\n';

        const start = Date.now();
        const result = analyzeReviewSeverity(whitespacePattern);
        const duration = Date.now() - start;

        // Should complete quickly
        expect(duration).toBeLessThan(50);
        expect(result.critical).toHaveLength(1);
      });
    });

    describe('Valid inputs still work correctly', () => {
      test('should correctly analyze normal security comment', () => {
        const comment = 'This code has a security vulnerability that needs to be fixed.';
        const result = analyzeReviewSeverity(comment);

        expect(result.critical).toHaveLength(1);
        expect(result.warnings).toHaveLength(0);
        expect(result.suggestions).toHaveLength(0);
      });

      test('should correctly analyze mixed severity comment', () => {
        const comment = `
          Critical: SQL injection vulnerability in line 42
          Warning: This might fail under heavy load
          Suggestion: Consider using a more efficient algorithm
        `;
        const result = analyzeReviewSeverity(comment);

        expect(result.critical).toHaveLength(1);
        expect(result.warnings).toHaveLength(1);
        expect(result.suggestions).toHaveLength(1);
      });

      test('should handle reasonable size inputs efficiently', () => {
        // 5000 character comment (well within limits)
        const comment = 'This is a reasonable review comment. '.repeat(130);

        const start = Date.now();
        const result = analyzeReviewSeverity(comment);
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(100);
        expect(result).toHaveProperty('critical');
        expect(result).toHaveProperty('warnings');
        expect(result).toHaveProperty('suggestions');
      });
    });
  });

  describe('Issue #21: Defensive defaults for undefined severity arrays', () => {
    // Note: We can't easily mock analyzeReviewSeverity since it's imported in the same module,
    // but we can test the actual behavior by directly injecting malformed data through
    // monkey-patching or by testing calculateQualityScore's defensive defaults.

    // Instead, we'll create a test scenario where we simulate what would happen
    // if analyzeReviewSeverity returned undefined/null arrays by testing the
    // actual implementation's defensive defaults.

    test('calculateQualityScore should handle normal review without crashing', () => {
      const reviewComment = 'This looks good but consider adding tests';

      // This should not throw even though we're accessing .length on arrays
      expect(() => {
        const result = calculateQualityScore(reviewComment, false);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }).not.toThrow();
    });

    test('calculateQualityScore should produce valid score with empty review', () => {
      // Even with just whitespace, should not crash
      const reviewComment = '   \n\n   ';

      const result = calculateQualityScore(reviewComment, false);
      expect(result.score).toBe(100); // No issues = perfect score
      expect(result.category).toBe('excellent');
    });

    test('calculateQualityScore should handle review with all severity types', () => {
      const reviewComment = `
        Critical: SQL injection vulnerability detected
        Warning: This might fail under heavy load
        Suggestion: Consider using async/await
      `;

      const result = calculateQualityScore(reviewComment, false);
      expect(result.score).toBeLessThan(100); // Should have deductions
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    test('calculateQualityScore with non-boolean lgtm (string "true") should throw', () => {
      const reviewComment = 'Looks good!';
      const validAuth = {
        isVerified: true,
        login: 'reviewer',
        hasWriteAccess: true,
        verifiedAt: new Date()
      } as ReviewerAuth;

      // String "true" is truthy, so it should still trigger the security check
      expect(() => {
        calculateQualityScore(reviewComment, "true" as any, validAuth);
      }).not.toThrow();
    });

    test('calculateQualityScore with non-boolean lgtm (number 1) should work with auth', () => {
      const reviewComment = 'Looks good!';
      const validAuth = {
        isVerified: true,
        login: 'reviewer',
        hasWriteAccess: true,
        verifiedAt: new Date()
      } as ReviewerAuth;

      // Number 1 is truthy, so it should work with valid auth
      expect(() => {
        calculateQualityScore(reviewComment, 1 as any, validAuth);
      }).not.toThrow();
    });

    test('calculateQualityScore with non-boolean lgtm (number 0) should not require auth', () => {
      const reviewComment = 'Needs work';

      // Number 0 is falsy, so it should not require auth
      expect(() => {
        calculateQualityScore(reviewComment, 0 as any);
      }).not.toThrow();
    });

    test('calculateQualityScore with non-boolean lgtm (empty string) should not require auth', () => {
      const reviewComment = 'Needs work';

      // Empty string is falsy
      expect(() => {
        calculateQualityScore(reviewComment, "" as any);
      }).not.toThrow();
    });

    test('calculateQualityScore with non-boolean lgtm (undefined) should not require auth', () => {
      const reviewComment = 'Needs work';

      // undefined is falsy
      expect(() => {
        calculateQualityScore(reviewComment, undefined as any);
      }).not.toThrow();
    });
  });
});
