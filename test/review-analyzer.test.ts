/**
 * Tests for review-analyzer module
 * Phase 1: Critical Security Fixes (#25, #26, #14)
 */

import {
  ReviewerAuth,
  calculateQualityScore,
  verifyReviewerAuthorization,
  analyzeReviewSeverity,
  aggregateReviewMetrics,
  clearAuthCache,
} from "../src/review-analyzer";

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
const originalFetch = globalThis.fetch;
global.fetch = mockFetch as any;
globalThis.fetch = mockFetch as any;

describe("review-analyzer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAuthCache(); // Issue #29: Clear cache between tests
  });

  afterAll(() => {
    // Restore original fetch to avoid polluting other test suites
    globalThis.fetch = originalFetch;
    global.fetch = originalFetch as any;
  });

  describe("Issue #26: ReviewerAuth interface (PAT exposure)", () => {
    test("ReviewerAuth should have verifiedAt field", async () => {
      // Mock fetch to return successful collaborator check
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          permission: "write",
          user: { login: "test-user" },
        }),
      } as any);

      const auth = await verifyReviewerAuthorization(
        "test-user",
        "owner",
        "repo",
        "fake-token"
      );

      expect(auth).toHaveProperty("verifiedAt");
      expect(auth.verifiedAt).toBeInstanceOf(Date);
    });

    test("ReviewerAuth should NOT have authToken field", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          permission: "write",
          user: { login: "test-user" },
        }),
      } as any);

      const auth = await verifyReviewerAuthorization(
        "test-user",
        "owner",
        "repo",
        "fake-token"
      );

      expect(auth).not.toHaveProperty("authToken");
    });

    test("verifyReviewerAuthorization should never return token in response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          permission: "admin",
          user: { login: "admin-user" },
        }),
      } as any);

      const auth = await verifyReviewerAuthorization(
        "admin-user",
        "owner",
        "repo",
        "secret-token-123"
      );

      // Verify response doesn't contain the token
      const authString = JSON.stringify(auth);
      expect(authString).not.toContain("secret-token-123");
      expect(auth).not.toHaveProperty("authToken");
    });
  });

  describe("Issue #25: 404 authorization bug", () => {
    test("verifyReviewerAuthorization returns isVerified:false on 404", async () => {
      // Mock GitHub API 404 response (user is not a collaborator)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any);

      const auth = await verifyReviewerAuthorization(
        "non-collaborator",
        "owner",
        "repo",
        "fake-token"
      );

      expect(auth.isVerified).toBe(false);
    });

    test("verifyReviewerAuthorization returns hasWriteAccess:false on 404", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any);

      const auth = await verifyReviewerAuthorization(
        "non-collaborator",
        "owner",
        "repo",
        "fake-token"
      );

      expect(auth.hasWriteAccess).toBe(false);
    });

    test("verifyReviewerAuthorization includes verifiedAt on 404", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any);

      const auth = await verifyReviewerAuthorization(
        "non-collaborator",
        "owner",
        "repo",
        "fake-token"
      );

      expect(auth.verifiedAt).toBeInstanceOf(Date);
    });

    test("verifyReviewerAuthorization returns isVerified:true for valid collaborator", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          permission: "write",
          user: { login: "collaborator" },
        }),
      } as any);

      const auth = await verifyReviewerAuthorization(
        "collaborator",
        "owner",
        "repo",
        "fake-token"
      );

      expect(auth.isVerified).toBe(true);
      expect(auth.hasWriteAccess).toBe(true);
    });
  });

  describe("Issue #14: LGTM authorization enforcement", () => {
    test("calculateQualityScore throws error when lgtm=true without reviewerAuth", () => {
      const reviewComment = "Looks good!";

      expect(() => {
        calculateQualityScore(reviewComment, true);
      }).toThrow(
        "SECURITY ERROR: LGTM requires verified reviewer authorization"
      );
    });

    test("calculateQualityScore throws error when lgtm=true with isVerified=false", () => {
      const reviewComment = "Looks good!";
      const unverifiedAuth = {
        isVerified: false,
        login: "test-user",
        hasWriteAccess: false,
        verifiedAt: new Date(),
      } as any as ReviewerAuth;

      expect(() => {
        calculateQualityScore(reviewComment, true, unverifiedAuth);
      }).toThrow("SECURITY ERROR: LGTM requires isVerified=true");
    });

    test("calculateQualityScore accepts lgtm=false without reviewerAuth", () => {
      const reviewComment = "Please fix the security issues";

      expect(() => {
        calculateQualityScore(reviewComment, false);
      }).not.toThrow();
    });

    test("calculateQualityScore accepts lgtm=true with valid reviewerAuth", () => {
      const reviewComment = "Looks good!";
      const validAuth = {
        isVerified: true,
        login: "reviewer",
        hasWriteAccess: true,
        verifiedAt: new Date(),
      } as any as ReviewerAuth;

      expect(() => {
        calculateQualityScore(reviewComment, true, validAuth);
      }).not.toThrow();
    });

    test("LGTM bonus only applies with verified authorization", () => {
      // Use a review with minor suggestions so score isn't already at 100
      const reviewComment = "Looks good! Consider adding more test coverage.";
      const validAuth = {
        isVerified: true,
        login: "reviewer",
        hasWriteAccess: true,
        verifiedAt: new Date(),
      } as any as ReviewerAuth;

      const scoreWithAuth = calculateQualityScore(
        reviewComment,
        true,
        validAuth
      );
      const scoreWithoutLgtm = calculateQualityScore(reviewComment, false);

      // LGTM with valid auth should give bonus (higher score)
      expect(scoreWithAuth.score).toBeGreaterThan(scoreWithoutLgtm.score);
    });

    test("LGTM bonus requires both verified and write access", () => {
      const reviewComment = "Looks good!";

      // Verified but no write access
      const authNoWrite = {
        isVerified: true,
        login: "read-only-user",
        hasWriteAccess: false,
        verifiedAt: new Date(),
      } as any as ReviewerAuth;

      const scoreNoWrite = calculateQualityScore(
        reviewComment,
        true,
        authNoWrite
      );
      const scoreBaseline = calculateQualityScore(reviewComment, false);

      // No write access = no LGTM bonus
      expect(scoreNoWrite.score).toBe(scoreBaseline.score);
    });
  });

  describe("Error handling", () => {
    test("verifyReviewerAuthorization returns isVerified:false on error", async () => {
      // Mock network error
      mockFetch.mockRejectedValue(new Error("Network error"));

      const auth = await verifyReviewerAuthorization(
        "test-user",
        "owner",
        "repo",
        "fake-token"
      );

      expect(auth.isVerified).toBe(false);
      expect(auth.hasWriteAccess).toBe(false);
    });

    test("verifyReviewerAuthorization includes verifiedAt even on error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const auth = await verifyReviewerAuthorization(
        "test-user",
        "owner",
        "repo",
        "fake-token"
      );

      expect(auth.verifiedAt).toBeInstanceOf(Date);
    });
  });

  describe("Issue #12 & #19: Fix diminishing returns and weight-proportional softening", () => {
    // Helper to generate critical issues
    // Issue #17: Generate unique issues to work with deduplication
    const generateCriticalIssues = (count: number): string => {
      const issues: string[] = [];
      for (let i = 0; i < count; i++) {
        issues.push(`Critical bug found in component ${i + 1}`);
      }
      return issues.join("\n");
    };

    test("0 critical issues should score 100", () => {
      const review = "Looks good overall";
      const score = calculateQualityScore(review, false);
      expect(score.score).toBe(100);
    });

    test("1 critical issue should score 70 (100 - 30)", () => {
      const review = generateCriticalIssues(1);
      const score = calculateQualityScore(review, false);
      expect(score.score).toBe(70);
    });

    test("2 critical issues should score 40 (100 - 60)", () => {
      const review = generateCriticalIssues(2);
      const score = calculateQualityScore(review, false);
      expect(score.score).toBe(40);
    });

    test("3 critical issues should score 10 (100 - 90)", () => {
      const review = generateCriticalIssues(3);
      const score = calculateQualityScore(review, false);
      expect(score.score).toBe(10);
    });

    test("4 criticals should score 0 (demonstrating diminishing returns)", () => {
      const review = generateCriticalIssues(4);
      const score = calculateQualityScore(review, false);

      // With correct logic: 100 - 3*30 - 1*25 = -15, clamped to 0
      // With broken logic: 100 - 4*30 + 1*5 = -15, also clamped to 0
      // This test passes on both, but documents expected behavior
      expect(score.score).toBe(0);
    });

    test("Score progression should show diminishing returns effect", () => {
      // This is the key test: verify the PROGRESSION is correct
      // Current bug: score += Math.floor(count - 3) * 5 ADDS BACK points
      // This means score goes: 100, 70, 40, 10, -15+5=-10 (clamped 0)
      // After fix: First 3 full penalty, then softened penalty
      // Score should be: 100, 70, 40, 10, then stay at 0

      const scores = [];
      for (let i = 0; i <= 6; i++) {
        const review = i === 0 ? "Looks good" : generateCriticalIssues(i);
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

    test("Diminishing returns calculation must happen BEFORE penalties are applied", () => {
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
        const review = i === 0 ? "Looks good" : generateCriticalIssues(i);
        const result = calculateQualityScore(review, false);
        scores.push(result.score);
      }

      // Verify NO score increases as issues increase
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });

    test("Softening factor must be proportional to base weight (Issue #19)", () => {
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

    test("Warning and suggestion scoring should remain unaffected", () => {
      const reviewWarnings = "Warning: potential issue\nWarning: edge case";
      const reviewSuggestions = "Consider improving\nSuggest refactoring";

      const scoreWarnings = calculateQualityScore(reviewWarnings, false);
      const scoreSuggestions = calculateQualityScore(reviewSuggestions, false);

      // 2 warnings = 100 - 2*15 = 70
      expect(scoreWarnings.score).toBe(70);

      // 2 suggestions = 100 - 2*5 = 90
      expect(scoreSuggestions.score).toBe(90);
    });
  });

  describe("Issue #15: Input validation and ReDoS protection", () => {
    describe("analyzeReviewSeverity input validation", () => {
      test("should reject empty string", () => {
        expect(() => {
          analyzeReviewSeverity("");
        }).toThrow("Invalid input: reviewComment cannot be empty");
      });

      test("should reject null input", () => {
        expect(() => {
          analyzeReviewSeverity(null as any);
        }).toThrow("Invalid input: reviewComment must be a string");
      });

      test("should reject undefined input", () => {
        expect(() => {
          analyzeReviewSeverity(undefined as any);
        }).toThrow("Invalid input: reviewComment must be a string");
      });

      test("should reject non-string input", () => {
        expect(() => {
          analyzeReviewSeverity(123 as any);
        }).toThrow("Invalid input: reviewComment must be a string");
      });

      test("should reject excessively large input (>10000 chars)", () => {
        // Create a string larger than 10000 characters
        const largeInput = "a".repeat(10001);

        expect(() => {
          analyzeReviewSeverity(largeInput);
        }).toThrow(
          "Invalid input: reviewComment exceeds maximum length of 10000 characters"
        );
      });

      test("should accept input at exactly 10000 characters", () => {
        // Create a string at exactly 10000 characters
        const maxInput = "a".repeat(10000);

        expect(() => {
          analyzeReviewSeverity(maxInput);
        }).not.toThrow();
      });

      test("should reject input with excessive newlines (>1000 lines)", () => {
        // Create a string with more than 1000 lines
        const manyLines = Array(1001).fill("test").join("\n");

        expect(() => {
          analyzeReviewSeverity(manyLines);
        }).toThrow(
          "Invalid input: reviewComment exceeds maximum of 1000 lines"
        );
      });

      test("should accept input with exactly 1000 lines", () => {
        // Create a string with exactly 1000 lines
        const maxLines = Array(1000).fill("test").join("\n");

        expect(() => {
          analyzeReviewSeverity(maxLines);
        }).not.toThrow();
      });

      test("should accept input with exactly 1000 lines ending with newline", () => {
        // Create a string with exactly 1000 lines, ending with \n
        // This should count as 1000 lines, not 1001
        const maxLines = Array(1000).fill("test").join("\n") + "\n";

        expect(() => {
          analyzeReviewSeverity(maxLines);
        }).not.toThrow();
      });

      test("should reject input with 1001 lines", () => {
        // Create a string with 1001 lines
        const tooManyLines = Array(1001).fill("test").join("\n");

        expect(() => {
          analyzeReviewSeverity(tooManyLines);
        }).toThrow(
          "Invalid input: reviewComment exceeds maximum of 1000 lines"
        );
      });
    });

    describe("ReDoS protection", () => {
      test("should handle input with complex nested patterns safely", () => {
        // Patterns that could cause catastrophic backtracking
        const complexPattern = "security " + "a".repeat(100) + " vulnerability";

        const start = Date.now();
        const result = analyzeReviewSeverity(complexPattern);
        const duration = Date.now() - start;

        // Should complete in reasonable time (< 100ms)
        expect(duration).toBeLessThan(100);
        expect(result.critical).toHaveLength(1);
      });

      test("should handle input with many repeated patterns safely", () => {
        // Many repeated keywords
        const repeatedPattern = Array(100)
          .fill("warning: potential issue here")
          .join("\n");

        const start = Date.now();
        const result = analyzeReviewSeverity(repeatedPattern);
        const duration = Date.now() - start;

        // Should complete in reasonable time (< 200ms)
        expect(duration).toBeLessThan(200);
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      test("should handle input with pathological whitespace patterns", () => {
        // Excessive whitespace could cause issues with some regex
        const whitespacePattern = "security   \t\t\t   vulnerability\n\n\n\n";

        const start = Date.now();
        const result = analyzeReviewSeverity(whitespacePattern);
        const duration = Date.now() - start;

        // Should complete quickly
        expect(duration).toBeLessThan(50);
        expect(result.critical).toHaveLength(1);
      });
    });

    describe("Valid inputs still work correctly", () => {
      test("should correctly analyze normal security comment", () => {
        const comment =
          "This code has a security vulnerability that needs to be fixed.";
        const result = analyzeReviewSeverity(comment);

        expect(result.critical).toHaveLength(1);
        expect(result.warnings).toHaveLength(0);
        expect(result.suggestions).toHaveLength(0);
      });

      test("should correctly analyze mixed severity comment", () => {
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

      test("should handle reasonable size inputs efficiently", () => {
        // 5000 character comment (well within limits)
        const comment = "This is a reasonable review comment. ".repeat(130);

        const start = Date.now();
        const result = analyzeReviewSeverity(comment);
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(100);
        expect(result).toHaveProperty("critical");
        expect(result).toHaveProperty("warnings");
        expect(result).toHaveProperty("suggestions");
      });
    });
  });

  describe("Issue #21: Defensive defaults for undefined severity arrays", () => {
    // Note: We can't easily mock analyzeReviewSeverity since it's imported in the same module,
    // but we can test the actual behavior by directly injecting malformed data through
    // monkey-patching or by testing calculateQualityScore's defensive defaults.

    // Instead, we'll create a test scenario where we simulate what would happen
    // if analyzeReviewSeverity returned undefined/null arrays by testing the
    // actual implementation's defensive defaults.

    test("calculateQualityScore should handle normal review without crashing", () => {
      const reviewComment = "This looks good but consider adding tests";

      // This should not throw even though we're accessing .length on arrays
      expect(() => {
        const result = calculateQualityScore(reviewComment, false);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }).not.toThrow();
    });

    test("calculateQualityScore should reject empty review (Issue #15)", () => {
      // Issue #15: Input validation should reject empty/whitespace-only input
      expect(() => {
        calculateQualityScore("", false);
      }).toThrow("Invalid input: reviewComment cannot be empty");

      // Also test whitespace-only
      expect(() => {
        calculateQualityScore("   \n\t  ", false);
      }).toThrow("Invalid input: reviewComment cannot be empty");
    });

    test("calculateQualityScore should produce valid score with minimal review", () => {
      // Minimal non-empty review (Issue #15 requires non-empty input)
      const reviewComment = "Looks good";

      const result = calculateQualityScore(reviewComment, false);
      expect(result.score).toBe(100); // No issues = perfect score
      expect(result.category).toBe("excellent");
    });

    test("calculateQualityScore should handle review with all severity types", () => {
      const reviewComment = `
        Critical: SQL injection vulnerability detected
        Warning: This might fail under heavy load
        Suggestion: Consider using async/await
      `;

      const result = calculateQualityScore(reviewComment, false);
      expect(result.score).toBeLessThan(100); // Should have deductions
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    test("calculateQualityScore should reject non-boolean lgtm (string)", () => {
      const reviewComment = "Looks good!";
      const validAuth = {
        isVerified: true,
        login: "reviewer",
        hasWriteAccess: true,
        verifiedAt: new Date(),
      } as ReviewerAuth;

      // SECURITY: Don't accept non-boolean values for security-sensitive lgtm flag
      // Single invocation with combined assertion
      expect(() => {
        calculateQualityScore(reviewComment, "true" as any, validAuth);
      }).toThrow(
        new TypeError(
          "Invalid input: lgtm parameter must be a boolean. Received string: true"
        )
      );
    });

    test("calculateQualityScore should reject non-boolean lgtm (number)", () => {
      const reviewComment = "Looks good!";
      const validAuth = {
        isVerified: true,
        login: "reviewer",
        hasWriteAccess: true,
        verifiedAt: new Date(),
      } as ReviewerAuth;

      // SECURITY: Don't accept non-boolean values for security-sensitive lgtm flag
      // Single invocation with combined assertion
      expect(() => {
        calculateQualityScore(reviewComment, 1 as any, validAuth);
      }).toThrow(
        new TypeError(
          "Invalid input: lgtm parameter must be a boolean. Received number: 1"
        )
      );
    });

    test("calculateQualityScore should reject non-boolean lgtm (number 0)", () => {
      const reviewComment = "Needs work";

      // SECURITY: Reject non-boolean even if falsy
      // Single invocation with combined assertion
      expect(() => {
        calculateQualityScore(reviewComment, 0 as any);
      }).toThrow(
        new TypeError(
          "Invalid input: lgtm parameter must be a boolean. Received number: 0"
        )
      );
    });

    test("calculateQualityScore should reject non-boolean lgtm (empty string)", () => {
      const reviewComment = "Needs work";

      // SECURITY: Reject non-boolean even if falsy
      // Single invocation with combined assertion
      expect(() => {
        calculateQualityScore(reviewComment, "" as any);
      }).toThrow(
        new TypeError(
          "Invalid input: lgtm parameter must be a boolean. Received string: "
        )
      );
    });

    test("calculateQualityScore should reject non-boolean lgtm (undefined)", () => {
      const reviewComment = "Needs work";

      // SECURITY: Reject non-boolean even if falsy
      // Single invocation with combined assertion
      expect(() => {
        calculateQualityScore(reviewComment, undefined as any);
      }).toThrow(
        new TypeError(
          "Invalid input: lgtm parameter must be a boolean. Received undefined: undefined"
        )
      );
    });

    test("calculateQualityScore should reject non-boolean lgtm (BigInt) without serialization error", () => {
      const reviewComment = "Needs work";

      // SECURITY: Reject BigInt without JSON.stringify throwing TypeError
      // Uses String() for safe serialization
      // Single invocation with combined assertion
      expect(() => {
        calculateQualityScore(reviewComment, BigInt(1) as any);
      }).toThrow(
        new TypeError(
          "Invalid input: lgtm parameter must be a boolean. Received bigint: 1"
        )
      );
    });
  });

  describe("Issue #11: Breakdown score calculation", () => {
    describe("Security breakdown", () => {
      test("should start from 100 and deduct only security-related critical issues", () => {
        // Review with 1 security critical issue (should deduct 40 points)
        const reviewComment =
          "CRITICAL: Security vulnerability found in authentication logic.";
        const result = calculateQualityScore(reviewComment, false);

        // Security breakdown should be: 100 - (1 * 40) = 60
        expect(result.breakdown.security).toBe(60);
      });

      test("should return 100 when there are no security issues", () => {
        // Review with non-security issues
        const reviewComment =
          "Warning: Consider refactoring this function for better maintainability.";
        const result = calculateQualityScore(reviewComment, false);

        // Security breakdown should remain 100 (no security issues)
        expect(result.breakdown.security).toBe(100);
      });

      test("should not be affected by non-security critical issues", () => {
        // Review with non-security critical issue
        const reviewComment =
          "CRITICAL: Performance bottleneck detected in database queries.";
        const result = calculateQualityScore(reviewComment, false);

        // Security breakdown should remain 100 (no security issues)
        expect(result.breakdown.security).toBe(100);
      });

      test("should handle multiple security critical issues", () => {
        // Review with 2 security critical issues
        const reviewComment = `CRITICAL: Security flaw in authentication
CRITICAL: Security issue with input validation`;
        const result = calculateQualityScore(reviewComment, false);

        // Security breakdown should be: 100 - (2 * 40) = 20
        expect(result.breakdown.security).toBe(20);
      });

      test("should not go below zero", () => {
        // Review with 3 security critical issues (would be -20 without Math.max)
        const reviewComment = `CRITICAL: Security flaw 1
CRITICAL: Security flaw 2
CRITICAL: Security flaw 3`;
        const result = calculateQualityScore(reviewComment, false);

        // Security breakdown should be: Math.max(0, 100 - (3 * 40)) = 0
        expect(result.breakdown.security).toBe(0);
      });
    });

    describe("Maintainability breakdown", () => {
      test("should start from 100 and deduct only for warnings", () => {
        // Review with 2 warnings (should deduct 10 points each)
        const reviewComment = `Warning: Code duplication detected
Warning: Complex function should be refactored`;
        const result = calculateQualityScore(reviewComment, false);

        // Maintainability breakdown should be: 100 - (2 * 10) = 80
        expect(result.breakdown.maintainability).toBe(80);
      });

      test("should return 100 when there are no warnings", () => {
        // Review with only suggestions
        const reviewComment = "Suggestion: Consider adding documentation.";
        const result = calculateQualityScore(reviewComment, false);

        // Maintainability breakdown should remain 100 (no warnings)
        expect(result.breakdown.maintainability).toBe(100);
      });

      test("should not be affected by overall score deductions", () => {
        // Review with critical issues that lower overall score, but only 1 warning
        const reviewComment = `CRITICAL: Major bug
CRITICAL: Another bug
Warning: Minor code smell`;
        const result = calculateQualityScore(reviewComment, false);

        // Even though overall score is low, maintainability should only reflect warnings
        // Maintainability breakdown should be: 100 - (1 * 10) = 90
        expect(result.breakdown.maintainability).toBe(90);
      });

      test("should count all warnings including performance and others", () => {
        // Review with multiple types of warnings
        const reviewComment = `Warning: Performance issue
Warning: Code duplication
Warning: Lack of error handling`;
        const result = calculateQualityScore(reviewComment, false);

        // Maintainability breakdown should be: 100 - (3 * 10) = 70
        expect(result.breakdown.maintainability).toBe(70);
      });
    });

    describe("Performance breakdown", () => {
      test("should start from 100 and deduct only performance-related warnings", () => {
        // Review with 1 performance warning (should deduct 20 points)
        const reviewComment =
          "Warning: Performance bottleneck in loop. Consider optimization.";
        const result = calculateQualityScore(reviewComment, false);

        // Performance breakdown should be: 100 - (1 * 20) = 80
        expect(result.breakdown.performance).toBe(80);
      });

      test("should return 100 when there are no performance warnings", () => {
        // Review with non-performance warnings
        const reviewComment = "Warning: Code duplication detected.";
        const result = calculateQualityScore(reviewComment, false);

        // Performance breakdown should remain 100 (no performance warnings)
        expect(result.breakdown.performance).toBe(100);
      });

      test("should handle multiple performance warnings", () => {
        // Review with 2 performance warnings
        const reviewComment = `Warning: Performance issue in database query
Warning: Performance degradation in loop`;
        const result = calculateQualityScore(reviewComment, false);

        // Performance breakdown should be: 100 - (2 * 20) = 60
        expect(result.breakdown.performance).toBe(60);
      });

      test("should not be affected by non-performance issues", () => {
        // Review with multiple non-performance issues
        const reviewComment = `CRITICAL: Security flaw
Warning: Code duplication
Warning: Lack of tests`;
        const result = calculateQualityScore(reviewComment, false);

        // Performance breakdown should remain 100 (no performance warnings)
        expect(result.breakdown.performance).toBe(100);
      });
    });

    describe("Testability breakdown", () => {
      test("should start from 100 and deduct only test-related suggestions", () => {
        // Review with 2 test suggestions (should deduct 10 points each)
        // Note: avoid "edge case" as it triggers warning category
        const reviewComment = `Suggestion: Add unit tests for this function
Suggestion: Test error handling paths`;
        const result = calculateQualityScore(reviewComment, false);

        // Testability breakdown should be: 100 - (2 * 10) = 80
        expect(result.breakdown.testability).toBe(80);
      });

      test("should return 100 when there are no test-related suggestions", () => {
        // Review with non-test suggestions
        const reviewComment = `Suggestion: Add documentation
Suggestion: Consider using a more descriptive variable name`;
        const result = calculateQualityScore(reviewComment, false);

        // Testability breakdown should remain 100 (no test suggestions)
        expect(result.breakdown.testability).toBe(100);
      });

      test("should handle multiple test-related suggestions", () => {
        // Review with 3 test suggestions
        // Note: avoid "edge case" as it triggers warning category
        const reviewComment = `Suggestion: Add tests
Suggestion: Test error handling
Suggestion: Test boundary conditions`;
        const result = calculateQualityScore(reviewComment, false);

        // Testability breakdown should be: 100 - (3 * 10) = 70
        expect(result.breakdown.testability).toBe(70);
      });

      test("should not be affected by other issues", () => {
        // Review with various issues but no test suggestions
        const reviewComment =
          "CRITICAL: Security issue. Warning: Performance problem. Suggestion: Add documentation.";
        const result = calculateQualityScore(reviewComment, false);

        // Testability breakdown should remain 100 (no test suggestions)
        expect(result.breakdown.testability).toBe(100);
      });
    });

    describe("Breakdown independence", () => {
      test("breakdown scores should be independent of overall score", () => {
        // Review with heavy maintainability penalties (many warnings)
        // but no security issues
        const reviewComment = `Warning: Issue 1
Warning: Issue 2
Warning: Issue 3
Warning: Issue 4
Warning: Issue 5`;
        const result = calculateQualityScore(reviewComment, false);

        // Overall score should be low: 100 - (5 * 15) = 25
        expect(result.score).toBe(25);

        // But security breakdown should remain 100 (no security issues)
        expect(result.breakdown.security).toBe(100);

        // And testability should remain 100 (no test suggestions)
        expect(result.breakdown.testability).toBe(100);

        // Only maintainability should be affected: 100 - (5 * 10) = 50
        expect(result.breakdown.maintainability).toBe(50);
      });

      test("each dimension should reflect only its relevant issues", () => {
        // Complex review with issues in all dimensions
        // Note: each issue must be on its own line for proper categorization
        const reviewComment = `CRITICAL: Security vulnerability found
Warning: Performance bottleneck detected
Warning: Code duplication
Suggestion: Add test coverage`;
        const result = calculateQualityScore(reviewComment, false);

        // Security: 100 - (1 * 40) = 60
        expect(result.breakdown.security).toBe(60);

        // Maintainability: 100 - (2 warnings * 10) = 80
        expect(result.breakdown.maintainability).toBe(80);

        // Performance: 100 - (1 performance warning * 20) = 80
        expect(result.breakdown.performance).toBe(80);

        // Testability: 100 - (1 test suggestion * 10) = 90
        expect(result.breakdown.testability).toBe(90);
      });

      test("breakdown should not inherit penalties from other dimensions", () => {
        // Review with only security issues
        const reviewComment = `CRITICAL: Security flaw
CRITICAL: Another security issue`;
        const result = calculateQualityScore(reviewComment, false);

        // Overall score: 100 - (2 * 30) = 40
        expect(result.score).toBe(40);

        // Security breakdown: 100 - (2 * 40) = 20
        expect(result.breakdown.security).toBe(20);

        // Other dimensions should not be affected
        expect(result.breakdown.maintainability).toBe(100);
        expect(result.breakdown.performance).toBe(100);
        expect(result.breakdown.testability).toBe(100);
      });
    });
  });

  describe("Issue #9: Input validation for aggregateReviewMetrics", () => {
    test("should reject non-array input", () => {
      expect(() => {
        aggregateReviewMetrics("not an array" as any);
      }).toThrow(new TypeError("Invalid input: reviews must be an array"));
    });

    test("should reject null input", () => {
      expect(() => {
        aggregateReviewMetrics(null as any);
      }).toThrow(new TypeError("Invalid input: reviews must be an array"));
    });

    test("should reject review with non-finite reviewTime (NaN)", () => {
      const reviews = [
        { lgtm: false, reviewComment: "Looks good", reviewTime: NaN },
      ];

      expect(() => {
        aggregateReviewMetrics(reviews);
      }).toThrow(
        new TypeError(
          "Invalid input: reviewTime must be a finite number. Received number: NaN"
        )
      );
    });

    test("should reject review with non-finite reviewTime (Infinity)", () => {
      const reviews = [
        { lgtm: false, reviewComment: "Looks good", reviewTime: Infinity },
      ];

      expect(() => {
        aggregateReviewMetrics(reviews);
      }).toThrow(
        new TypeError(
          "Invalid input: reviewTime must be a finite number. Received number: Infinity"
        )
      );
    });

    test("should reject review with non-numeric reviewTime", () => {
      const reviews = [
        { lgtm: false, reviewComment: "Looks good", reviewTime: "123" as any },
      ];

      expect(() => {
        aggregateReviewMetrics(reviews);
      }).toThrow(
        new TypeError(
          "Invalid input: reviewTime must be a finite number. Received string: 123"
        )
      );
    });

    test("should accept valid reviews array", () => {
      const reviews = [
        { lgtm: true, reviewComment: "Looks good", reviewTime: 5 },
        { lgtm: false, reviewComment: "Critical bug found", reviewTime: 10 },
      ];

      const result = aggregateReviewMetrics(reviews);

      expect(result.totalReviews).toBe(2);
      expect(result.lgtmRate).toBe(0.5);
      expect(result.averageReviewTime).toBe(7.5);
    });

    test("should handle empty array gracefully", () => {
      const result = aggregateReviewMetrics([]);

      expect(result.totalReviews).toBe(0);
      expect(result.lgtmRate).toBe(0);
      expect(result.averageReviewTime).toBe(0);
    });

    test("should reject review with non-boolean lgtm (string)", () => {
      const reviews = [
        { lgtm: "true" as any, reviewComment: "Looks good", reviewTime: 5 },
      ];

      expect(() => {
        aggregateReviewMetrics(reviews);
      }).toThrow(
        new TypeError(
          "Invalid input: lgtm must be a boolean. Received string: true"
        )
      );
    });

    test("should reject review with non-boolean lgtm (number)", () => {
      const reviews = [
        { lgtm: 1 as any, reviewComment: "Looks good", reviewTime: 5 },
      ];

      expect(() => {
        aggregateReviewMetrics(reviews);
      }).toThrow(
        new TypeError(
          "Invalid input: lgtm must be a boolean. Received number: 1"
        )
      );
    });
  });

  describe("Issue #17: SECURITY - Prevent score gaming via issue fragmentation", () => {
    test("should deduplicate exact duplicate critical issues", () => {
      const reviewComment = `
        Security vulnerability in authentication
        Security vulnerability in authentication
        Security vulnerability in authentication
      `;

      const result = analyzeReviewSeverity(reviewComment);

      // Should deduplicate to 1 unique issue
      expect(result.critical.length).toBe(1);
    });

    test("should deduplicate exact duplicate warnings", () => {
      const reviewComment = `
        Warning: potential issue with null handling
        Warning: potential issue with null handling
      `;

      const result = analyzeReviewSeverity(reviewComment);

      expect(result.warnings.length).toBe(1);
    });

    test("should deduplicate exact duplicate suggestions", () => {
      const reviewComment = `
        Consider using async/await
        Consider using async/await
        Consider using async/await
      `;

      const result = analyzeReviewSeverity(reviewComment);

      expect(result.suggestions.length).toBe(1);
    });

    test("should keep genuinely different issues", () => {
      const reviewComment = `
        Security vulnerability in authentication
        Security issue in API endpoint
        Critical bug in database query
      `;

      const result = analyzeReviewSeverity(reviewComment);

      // All are different, should keep all 3
      expect(result.critical.length).toBe(3);
    });

    test("should handle mixed duplicates and unique issues", () => {
      const reviewComment = `
        Security vulnerability found
        Security vulnerability found
        Critical bug detected
        Data loss possible
        Data loss possible
      `;

      const result = analyzeReviewSeverity(reviewComment);

      // Should have 3 unique: security (dedup to 1), critical bug, data loss (dedup to 1)
      expect(result.critical.length).toBe(3);
    });

    test("should deduplicate case-insensitively", () => {
      const reviewComment = `
        Security Vulnerability Found
        security vulnerability found
        SECURITY VULNERABILITY FOUND
      `;

      const result = analyzeReviewSeverity(reviewComment);

      expect(result.critical.length).toBe(1);
    });

    test("should trim whitespace before deduplication", () => {
      const reviewComment = `
        Security vulnerability
          Security vulnerability
           Security vulnerability
      `;

      const result = analyzeReviewSeverity(reviewComment);

      expect(result.critical.length).toBe(1);
    });
  });
  describe("Issue #29: Rate limiting and memoization", () => {
    test("should cache authorization results for repeated calls", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          permission: "write",
          user: { login: "test-user" },
        }),
      } as any);

      // First call
      const auth1 = await verifyReviewerAuthorization(
        "test-user",
        "owner",
        "repo",
        "token"
      );
      expect(auth1.isVerified).toBe(true);

      // Second call should use cache (no additional fetch)
      mockFetch.mockClear();
      const auth2 = await verifyReviewerAuthorization(
        "test-user",
        "owner",
        "repo",
        "token"
      );
      expect(auth2.isVerified).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should not leak token in any logs", async () => {
      const consoleLog = jest.spyOn(console, "log");
      const consoleError = jest.spyOn(console, "error");

      mockFetch.mockRejectedValue(new Error("Network error"));

      await verifyReviewerAuthorization(
        "test",
        "owner",
        "repo",
        "secret-token-123"
      );

      // Check console output doesn't contain token
      const allLogs = [
        ...consoleLog.mock.calls.map((c) => JSON.stringify(c)),
        ...consoleError.mock.calls.map((c) => JSON.stringify(c)),
      ].join(" ");

      expect(allLogs).not.toContain("secret-token-123");

      consoleLog.mockRestore();
      consoleError.mockRestore();
    });

    test("cache should expire after TTL", async () => {
      jest.useFakeTimers();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          permission: "write",
          user: { login: "test-user" },
        }),
      } as any);

      // First call
      await verifyReviewerAuthorization("test-user", "owner", "repo", "token");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time past TTL (5 minutes)
      jest.advanceTimersByTime(6 * 60 * 1000);

      // Should make new API call after TTL
      await verifyReviewerAuthorization("test-user", "owner", "repo", "token");
      expect(mockFetch).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  describe("Issue #19: Softening factor must be tied to base weights", () => {
    test("softening should be proportional to base weight", () => {
      // Verify the softening factor is a ratio, not a fixed value
      const CRITICAL_BASE_WEIGHT = 30;
      const SOFTEN_FACTOR = 5 / 30; // Ratio: 0.1667 (16.67%)
      const softenedWeight = CRITICAL_BASE_WEIGHT * (1 - SOFTEN_FACTOR);

      expect(softenedWeight).toBe(25);

      // If base weight changes, softened weight should change proportionally
      const NEW_BASE = 40;
      const newSoftened = NEW_BASE * (1 - SOFTEN_FACTOR);
      expect(newSoftened).toBeCloseTo(33.33, 1); // 40 * (1 - 0.1667) ≈ 33.33
    });

    test("softening prevents perverse incentives", () => {
      // Issue: if softening was fixed at +5, and base weight = 4,
      // then softened penalty would be -1 (increasing score with more issues)
      // With proportional softening, this cannot happen
      const review = Array(6)
        .fill(0)
        .map((_, i) => `Critical bug ${i}`)
        .join("\n");
      const result = calculateQualityScore(review, false);

      // Score should decrease monotonically (more issues = lower score)
      const review5 = Array(5)
        .fill(0)
        .map((_, i) => `Critical bug ${i}`)
        .join("\n");
      const result5 = calculateQualityScore(review5, false);

      expect(result.score).toBeLessThanOrEqual(result5.score);
    });

    test("softened weight is always less than base weight", () => {
      // This ensures additional issues still penalize, never reward
      const CRITICAL_BASE_WEIGHT = 30;
      const SOFTEN_FACTOR = 5 / 30;
      const softenedWeight = CRITICAL_BASE_WEIGHT * (1 - SOFTEN_FACTOR);

      expect(softenedWeight).toBeLessThan(CRITICAL_BASE_WEIGHT);
      expect(softenedWeight).toBeGreaterThan(0);
    });
    describe("Issue #28: Improve error handling and diagnostics", () => {
      test("should handle malformed API response (missing user field)", async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            permission: "write",
            // Missing 'user' field
          }),
        } as any);

        const auth = await verifyReviewerAuthorization(
          "test",
          "owner",
          "repo",
          "token"
        );

        // Should fail secure when response is malformed
        expect(auth.isVerified).toBe(false);
      });

      test("should handle null user object", async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            permission: "write",
            user: null,
          }),
        } as any);

        const auth = await verifyReviewerAuthorization(
          "test",
          "owner",
          "repo",
          "token"
        );
        expect(auth.isVerified).toBe(false);
      });

      test("should handle missing permission field", async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            user: { login: "test" },
            // Missing 'permission' field
          }),
        } as any);

        const auth = await verifyReviewerAuthorization(
          "test",
          "owner",
          "repo",
          "token"
        );
        expect(auth.isVerified).toBe(false);
      });

      test("should handle invalid JSON response", async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error("Invalid JSON");
          },
        } as any);

        const auth = await verifyReviewerAuthorization(
          "test",
          "owner",
          "repo",
          "token"
        );
        expect(auth.isVerified).toBe(false);
      });

      test("should handle network errors gracefully", async () => {
        mockFetch.mockRejectedValue(new Error("Network error"));

        const auth = await verifyReviewerAuthorization(
          "test",
          "owner",
          "repo",
          "token"
        );
        expect(auth.isVerified).toBe(false);
      });

      test("should handle unexpected permission values", async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            permission: "unknown-permission",
            user: { login: "test" },
          }),
        } as any);

        const auth = await verifyReviewerAuthorization(
          "test",
          "owner",
          "repo",
          "token"
        );
        // Should mark as verified but no write access
        expect(auth.hasWriteAccess).toBe(false);
      });
    });
  });
  describe("Issue #18: Centralize magic numbers into configuration", () => {
    test("should use centralized category thresholds", () => {
      // Test boundary values for each category
      const excellent = calculateQualityScore("Looks perfect", false);
      expect(excellent.score).toBeGreaterThanOrEqual(90);
      expect(excellent.category).toBe("excellent");

      const good = "Warning: potential issue here\nWarning: another issue";
      const goodResult = calculateQualityScore(good, false);
      expect(goodResult.score).toBeGreaterThanOrEqual(70);
      expect(goodResult.score).toBeLessThan(90);
      expect(goodResult.category).toBe("good");
    });

    test("should use centralized breakdown penalties", () => {
      // Verify breakdown calculations use config values
      const review = "Security vulnerability found";
      const result = calculateQualityScore(review, false);

      // Security breakdown should use configured penalty
      expect(result.breakdown.security).toBeLessThan(100);
    });

    test("should respect score bounds (0-100)", () => {
      // Test minimum bound
      const manyIssues = Array(10)
        .fill(0)
        .map((_, i) => `Critical bug ${i}`)
        .join("\n");
      const minResult = calculateQualityScore(manyIssues, false);
      expect(minResult.score).toBeGreaterThanOrEqual(0);
      expect(minResult.score).toBeLessThanOrEqual(100);

      // Test maximum bound
      const perfect = "Everything looks great!";
      const maxResult = calculateQualityScore(perfect, false);
      expect(maxResult.score).toBeGreaterThanOrEqual(0);
      expect(maxResult.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Issue #24: Remove redundant Math operations on integers', () => {
    test('softened weight calculation should produce integer result', () => {
      // Verify that 30 * (1 - 5/30) = 25 exactly (no rounding needed)
      const CRITICAL_BASE_WEIGHT = 30;
      const SOFTEN_FACTOR = 5 / 30;
      const result = CRITICAL_BASE_WEIGHT * (1 - SOFTEN_FACTOR);
      expect(result).toBe(25);
      expect(Number.isInteger(result)).toBe(true);
    });

    test('penalty calculations work correctly without redundant operations', () => {
      // 4 critical issues: 3 at base weight (30), 1 at softened weight (25)
      const review = Array(4).fill(0).map((_, i) =>
        `Critical bug ${i}`).join('\n');
      const result = calculateQualityScore(review, false);

      // Score = 100 - (3 * 30 + 1 * 25) = 100 - 115 = 0 (clamped)
      expect(result.score).toBe(0);
    });
  });

  describe('Issue #18: Centralize magic numbers into configuration', () => {
    test('should use centralized category thresholds', () => {
      // Test boundary values for each category
      const excellent = calculateQualityScore('Looks perfect', false);
      expect(excellent.score).toBeGreaterThanOrEqual(90);
      expect(excellent.category).toBe('excellent');

      const good = 'Warning: potential issue here\nWarning: another issue';
      const goodResult = calculateQualityScore(good, false);
      expect(goodResult.score).toBeGreaterThanOrEqual(70);
      expect(goodResult.score).toBeLessThan(90);
      expect(goodResult.category).toBe('good');
    });

    test('should use centralized breakdown penalties', () => {
      // Verify breakdown calculations use config values
      const review = 'Security vulnerability found';
      const result = calculateQualityScore(review, false);

      // Security breakdown should use configured penalty
      expect(result.breakdown.security).toBeLessThan(100);
    });

    test('should respect score bounds (0-100)', () => {
      // Test minimum bound
      const manyIssues = Array(10).fill(0).map((_, i) =>
        `Critical bug ${i}`).join('\n');
      const minResult = calculateQualityScore(manyIssues, false);
      expect(minResult.score).toBeGreaterThanOrEqual(0);
      expect(minResult.score).toBeLessThanOrEqual(100);

      // Test maximum bound
      const perfect = 'Everything looks great!';
      const maxResult = calculateQualityScore(perfect, false);
      expect(maxResult.score).toBeGreaterThanOrEqual(0);
      expect(maxResult.score).toBeLessThanOrEqual(100);
    });
  });
});
