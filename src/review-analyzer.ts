/**
 * Advanced code review analytics and scoring
 * This module provides sophisticated analysis of code reviews
 */

// Using native fetch (Node 18+) - types from @types/node

/**
 * Scoring configuration constants
 * Extracted to module-level for maintainability and testability
 * Issue #18: Centralized all magic numbers for easier tuning
 */
const SEVERITY_WEIGHTS = {
  critical: {
    base: 30, // Full penalty for first N critical issues
    softened: 25, // Reduced penalty for additional critical issues (16.67% reduction)
  },
  warning: {
    base: 15, // Warning penalty (currently no softening applied)
    softened: 10, // Reserved for future adaptive thresholds
  },
  suggestion: {
    base: 5, // Suggestion penalty (currently no softening applied)
    softened: 3, // Reserved for future adaptive thresholds
  },
} as const;

const SCORING_CONFIG = {
  // Softening threshold
  SOFTENING_THRESHOLD: 3, // Number of issues before softening kicks in

  // LGTM scoring
  LGTM_BONUS: 10,
  LGTM_WITH_CRITICALS_PENALTY: 10,

  // Score bounds
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  INITIAL_SCORE: 100,

  // Category thresholds
  CATEGORY_THRESHOLDS: {
    EXCELLENT: 90,
    GOOD: 70,
    NEEDS_IMPROVEMENT: 50,
  },

  // Breakdown penalties (per issue)
  BREAKDOWN_PENALTIES: {
    SECURITY_CRITICAL: 40,
    MAINTAINABILITY_WARNING: 10,
    PERFORMANCE_WARNING: 20,
    TESTABILITY_SUGGESTION: 10,
  },
} as const;

export interface ReviewMetrics {
  totalReviews: number;
  criticalIssues: number;
  warnings: number;
  suggestions: number;
  lgtmRate: number;
  averageReviewTime: number;
}

export interface CodeQualityScore {
  score: number; // 0-100
  category: "excellent" | "good" | "needs-improvement" | "critical";
  breakdown: {
    security: number;
    maintainability: number;
    performance: number;
    testability: number;
  };
}

/**
 * Reviewer authorization information
 * Used to verify LGTM comes from authorized reviewers
 */
export interface ReviewerAuth {
  /**
   * Whether the reviewer is verified (server-side GitHub authorization)
   */
  isVerified: boolean;

  /**
   * Reviewer's GitHub login
   */
  login: string;

  /**
   * Whether the reviewer has write/admin permissions on the repo
   */
  hasWriteAccess: boolean;

  /**
   * Timestamp when authorization was verified
   * Used for auditing and cache invalidation
   */
  verifiedAt: Date;
}

/**
 * Deduplicates an array of issue strings
 * Issue #17: Prevent score gaming via issue fragmentation
 *
 * Normalizes strings (lowercase + trim) before comparison to detect duplicates
 * When duplicates found, keeps the longest version (most detailed)
 *
 * @param issues - Array of issue strings to deduplicate
 * @returns Deduplicated array with only unique issues
 */
function deduplicateIssues(issues: string[]): string[] {
  const seen = new Map<string, string>();

  for (const issue of issues) {
    // Normalize: trim whitespace and convert to lowercase for comparison
    const normalized = issue.trim().toLowerCase();

    const existing = seen.get(normalized);
    if (!existing || issue.length > existing.length) {
      // Keep this version if it's new or longer (more detailed)
      seen.set(normalized, issue);
    }
  }

  return Array.from(seen.values());
}

/**
 * Analyzes review content to extract severity levels
 * Uses pattern matching and NLP techniques to categorize issues
 *
 * Issue #15: Input validation and ReDoS protection
 * Issue #17: Deduplicates issues to prevent score gaming
 */
export function analyzeReviewSeverity(reviewComment: string): {
  critical: string[];
  warnings: string[];
  suggestions: string[];
} {
  // Input validation - protect against DoS and ReDoS attacks

  // Check if input is a string
  if (typeof reviewComment !== "string") {
    throw new Error("Invalid input: reviewComment must be a string");
  }

  // Check if input is empty or whitespace-only
  // Use regex \S to match all ECMAScript whitespace chars (including NBSP, form feed, etc.)
  if (!/\S/.test(reviewComment)) {
    throw new Error("Invalid input: reviewComment cannot be empty");
  }

  // Check maximum length (10000 characters) to prevent DoS
  const MAX_LENGTH = 10000;
  if (reviewComment.length > MAX_LENGTH) {
    throw new Error(
      `Invalid input: reviewComment exceeds maximum length of ${MAX_LENGTH} characters`
    );
  }

  // Check maximum number of lines (1000 lines) to prevent DoS
  // Count newlines and handle trailing newline correctly
  // Use early-exit to avoid processing malicious oversized inputs
  const MAX_LINES = 1000;
  let lineCount = 0;
  for (let i = 0; i < reviewComment.length; i++) {
    if (reviewComment[i] === "\n") {
      lineCount++;
      // Early exit if exceeded (DoS protection)
      if (lineCount > MAX_LINES) {
        throw new Error(
          `Invalid input: reviewComment exceeds maximum of ${MAX_LINES} lines`
        );
      }
    }
  }
  // If string doesn't end with newline, add 1 for the last line
  // If it ends with newline, lineCount already represents number of lines
  if (reviewComment[reviewComment.length - 1] !== "\n") {
    lineCount++;
    if (lineCount > MAX_LINES) {
      throw new Error(
        `Invalid input: reviewComment exceeds maximum of ${MAX_LINES} lines`
      );
    }
  }

  const critical: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Split by lines and analyze each
  const lines = reviewComment.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Critical issues - security, bugs, breaking changes
    if (
      lowerLine.includes("security") ||
      lowerLine.includes("vulnerability") ||
      lowerLine.includes("sql injection") ||
      lowerLine.includes("xss") ||
      lowerLine.includes("critical bug") ||
      lowerLine.includes("data loss")
    ) {
      critical.push(line);
    }
    // Warnings - potential issues, code smells
    else if (
      lowerLine.includes("warning") ||
      lowerLine.includes("potential issue") ||
      lowerLine.includes("might fail") ||
      lowerLine.includes("edge case") ||
      lowerLine.includes("race condition")
    ) {
      warnings.push(line);
    }
    // Suggestions - improvements, best practices
    else if (
      lowerLine.includes("consider") ||
      lowerLine.includes("suggest") ||
      lowerLine.includes("recommend") ||
      lowerLine.includes("could be") ||
      lowerLine.includes("better to")
    ) {
      suggestions.push(line);
    }
  }

  // Issue #17: Deduplicate issues to prevent score gaming via fragmentation
  // Normalize and remove duplicates from each severity category
  return {
    critical: deduplicateIssues(critical),
    warnings: deduplicateIssues(warnings),
    suggestions: deduplicateIssues(suggestions),
  };
}

/**
 * Calculates code quality score based on review metrics
 * Uses weighted scoring algorithm with diminishing returns on critical issues
 *
 * Scoring behavior:
 * - Base weights: critical (30), warning (15), suggestion (5)
 * - Diminishing returns: First 3 critical issues at full penalty (30 each),
 *   additional critical issues softened to 25 each (16.67% reduction)
 * - LGTM bonus (+10) only for authorized reviewers with zero critical issues
 * - LGTM penalty (-10) for authorized reviewers who approve despite critical issues
 * - Category thresholds: excellent (90+), good (70+), needs-improvement (50+), critical (<50)
 *
 * SECURITY: LGTM scoring requires verified reviewer authorization.
 * Do NOT trust LGTM from parsed comment content - require server-side
 * verification via GitHub API (reviewer permissions, signed events).
 *
 * @param reviewComment - The review comment text to analyze
 * @param lgtm - LGTM flag (deprecated - use reviewerAuth instead)
 * @param reviewerAuth - Server-side verified reviewer authorization (optional)
 * @param requiredApprovers - Minimum number of authorized approvers (default: 1)
 */
export function calculateQualityScore(
  reviewComment: string,
  lgtm: boolean,
  reviewerAuth?: ReviewerAuth,
  _requiredApprovers: number = 1
): CodeQualityScore {
  // SECURITY: Validate lgtm parameter type before making security decisions
  if (typeof lgtm !== "boolean") {
    throw new TypeError(
      "Invalid input: lgtm parameter must be a boolean. " +
        `Received ${typeof lgtm}: ${String(lgtm)}`
    );
  }

  // SECURITY: Enforce authorization when LGTM is claimed
  if (lgtm && !reviewerAuth) {
    throw new Error(
      "SECURITY ERROR: LGTM requires verified reviewer authorization. " +
        "Call verifyReviewerAuthorization() first and pass the result as reviewerAuth parameter."
    );
  }

  // Additional check: even with reviewerAuth, verify it's actually verified
  if (lgtm && reviewerAuth && !reviewerAuth.isVerified) {
    throw new Error(
      "SECURITY ERROR: LGTM requires isVerified=true in reviewerAuth. " +
        "The provided authorization is not verified."
    );
  }

  const severity = analyzeReviewSeverity(reviewComment);

  // Defensive defaults: Protect against undefined/null arrays from analyzeReviewSeverity
  // Issue #21: Add defensive defaults for undefined severity arrays
  // Also guard against severity itself being null/undefined (defense in depth)
  const { critical = [], warnings = [], suggestions = [] } = severity ?? {};

  let score: number = SCORING_CONFIG.INITIAL_SCORE;

  // Calculate critical penalty with diminishing returns built in
  // First N criticals: full penalty (base weight)
  // Additional criticals: softened penalty (softened weight)
  // This prevents unfairly harsh scoring when multiple related issues exist
  const criticalCount = critical.length;

  const criticalPenalty =
    Math.min(criticalCount, SCORING_CONFIG.SOFTENING_THRESHOLD) *
      SEVERITY_WEIGHTS.critical.base +
    Math.max(0, criticalCount - SCORING_CONFIG.SOFTENING_THRESHOLD) *
      SEVERITY_WEIGHTS.critical.softened;

  // Deduct points based on issues found with severity weighting
  score -= criticalPenalty; // Critical issues with diminishing returns
  score -= warnings.length * SEVERITY_WEIGHTS.warning.base;
  score -= suggestions.length * SEVERITY_WEIGHTS.suggestion.base;

  // LGTM bonus - ONLY if reviewer is verified and authorized
  // SECURITY: Never trust LGTM from parsed comment content alone
  const isAuthorizedLgtm = reviewerAuth
    ? reviewerAuth.isVerified && reviewerAuth.hasWriteAccess && lgtm
    : false; // Default to false if no auth provided

  if (isAuthorizedLgtm && critical.length === 0) {
    score = Math.min(
      SCORING_CONFIG.MAX_SCORE,
      score + SCORING_CONFIG.LGTM_BONUS
    );
  }

  // Penalty for LGTM with critical issues (authorized reviewer made a mistake)
  if (isAuthorizedLgtm && critical.length > 0) {
    score -= SCORING_CONFIG.LGTM_WITH_CRITICALS_PENALTY;
  }

  // Ensure score is in valid range
  score = Math.max(
    SCORING_CONFIG.MIN_SCORE,
    Math.min(SCORING_CONFIG.MAX_SCORE, score)
  );

  // Categorize using centralized thresholds
  let category: CodeQualityScore["category"];
  if (score >= SCORING_CONFIG.CATEGORY_THRESHOLDS.EXCELLENT)
    category = "excellent";
  else if (score >= SCORING_CONFIG.CATEGORY_THRESHOLDS.GOOD) category = "good";
  else if (score >= SCORING_CONFIG.CATEGORY_THRESHOLDS.NEEDS_IMPROVEMENT)
    category = "needs-improvement";
  else category = "critical";

  // Simple breakdown (could be enhanced with more sophisticated analysis)
  // Issue #11: Each dimension starts from 100 and deducts only relevant issues
  // Issue #18: Use centralized breakdown penalties
  const breakdown = {
    security: Math.max(
      SCORING_CONFIG.MIN_SCORE,
      SCORING_CONFIG.MAX_SCORE -
        critical.filter((c) => c.toLowerCase().includes("security")).length *
          SCORING_CONFIG.BREAKDOWN_PENALTIES.SECURITY_CRITICAL
    ),
    maintainability: Math.max(
      SCORING_CONFIG.MIN_SCORE,
      SCORING_CONFIG.MAX_SCORE -
        warnings.length *
          SCORING_CONFIG.BREAKDOWN_PENALTIES.MAINTAINABILITY_WARNING
    ),
    performance: Math.max(
      SCORING_CONFIG.MIN_SCORE,
      SCORING_CONFIG.MAX_SCORE -
        warnings.filter((w) => w.toLowerCase().includes("performance")).length *
          SCORING_CONFIG.BREAKDOWN_PENALTIES.PERFORMANCE_WARNING
    ),
    testability: Math.max(
      SCORING_CONFIG.MIN_SCORE,
      SCORING_CONFIG.MAX_SCORE -
        suggestions.filter((s) => s.toLowerCase().includes("test")).length *
          SCORING_CONFIG.BREAKDOWN_PENALTIES.TESTABILITY_SUGGESTION
    ),
  };

  return {
    score,
    category,
    breakdown,
  };
}

/**
 * Generates metrics from a collection of reviews
 */
export function aggregateReviewMetrics(
  reviews: Array<{ lgtm: boolean; reviewComment: string; reviewTime: number }>
): ReviewMetrics {
  // Input validation (Issue #9)
  if (!Array.isArray(reviews)) {
    throw new TypeError("Invalid input: reviews must be an array");
  }

  let criticalIssues = 0;
  let warnings = 0;
  let suggestions = 0;
  let lgtmCount = 0;
  let totalTime = 0;

  for (const review of reviews) {
    // Validate lgtm is a boolean
    if (typeof review.lgtm !== "boolean") {
      throw new TypeError(
        `Invalid input: lgtm must be a boolean. ` +
          `Received ${typeof review.lgtm}: ${String(review.lgtm)}`
      );
    }

    // Validate reviewTime is a finite number
    if (!Number.isFinite(review.reviewTime)) {
      throw new TypeError(
        `Invalid input: reviewTime must be a finite number. ` +
          `Received ${typeof review.reviewTime}: ${String(review.reviewTime)}`
      );
    }

    // analyzeReviewSeverity validates reviewComment (Issue #15)
    const severity = analyzeReviewSeverity(review.reviewComment);
    criticalIssues += severity.critical.length;
    warnings += severity.warnings.length;
    suggestions += severity.suggestions.length;

    if (review.lgtm) lgtmCount++;
    totalTime += review.reviewTime;
  }

  return {
    totalReviews: reviews.length,
    criticalIssues,
    warnings,
    suggestions,
    lgtmRate: reviews.length > 0 ? lgtmCount / reviews.length : 0,
    averageReviewTime: reviews.length > 0 ? totalTime / reviews.length : 0,
  };
}

/**
 * Issue #29: Authorization cache for rate limiting
 * Caches authorization results to avoid redundant API calls
 * Implements bounded LRU-style cache with automatic eviction
 */
const authCache = new Map<
  string,
  { result: ReviewerAuth; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000; // Prevent unbounded growth

/**
 * Clears the authorization cache
 * Exported for testing purposes
 */
export function clearAuthCache(): void {
  authCache.clear();
}

/**
 * Verifies reviewer authorization from GitHub API
 * SECURITY: This function MUST query GitHub's API server-side to verify permissions.
 * Never trust client-provided authorization data.
 *
 * Issue #29: Implements memoization to reduce API calls and avoid rate limits
 *
 * @param githubLogin - Reviewer's GitHub login
 * @param repoOwner - Repository owner
 * @param repoName - Repository name
 * @param githubToken - GitHub API token with repo permissions (never logged)
 * @returns Verified reviewer authorization
 *
 * @example
 * ```typescript
 * // Server-side verification required
 * const auth = await verifyReviewerAuthorization(
 *   'reviewer-login',
 *   'owner',
 *   'repo',
 *   process.env.GITHUB_TOKEN
 * );
 *
 * const score = calculateQualityScore(
 *   reviewComment,
 *   lgtm,
 *   auth  // Only use if verified server-side
 * );
 * ```
 */
export async function verifyReviewerAuthorization(
  githubLogin: string,
  repoOwner: string,
  repoName: string,
  githubToken: string
): Promise<ReviewerAuth> {
  // Issue #29: Check cache first to avoid redundant API calls
  // URL encode parameters to handle special characters
  const encodedOwner = encodeURIComponent(repoOwner);
  const encodedRepo = encodeURIComponent(repoName);
  const encodedLogin = encodeURIComponent(githubLogin);
  const cacheKey = `${encodedOwner}/${encodedRepo}/${encodedLogin}`;

  const cached = authCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  // Evict oldest entries if cache is full (LRU-style)
  if (authCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = authCache.keys().next().value;
    if (oldestKey) authCache.delete(oldestKey);
  }

  try {
    // Query GitHub API to verify reviewer permissions
    // GET /repos/{owner}/{repo}/collaborators/{username}/permission
    const response = await globalThis.fetch(
      `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/collaborators/${encodedLogin}/permission`,
      {
        method: "GET",
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "ChatGPT-CodeReview-Bot",
        },
      }
    );

    if (!response.ok) {
      // If user is not a collaborator, GitHub returns 404
      if (response.status === 404) {
        const result: ReviewerAuth = {
          isVerified: false, // User is not a collaborator
          login: githubLogin,
          hasWriteAccess: false,
          verifiedAt: new Date(),
        };

        // Cache negative results too (avoid repeated 404s)
        authCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as {
      permission?: string;
      user?: { login?: string } | null;
    };

    // Issue #28: Validate response structure before dereferencing
    // Fail secure if response is malformed
    if (
      !data ||
      !data.user ||
      typeof data.user.login !== "string" ||
      typeof data.permission !== "string"
    ) {
      console.error("Malformed GitHub API response:", {
        hasData: !!data,
        hasUser: !!data?.user,
        hasLogin: typeof data?.user?.login,
        hasPermission: typeof data?.permission,
      });

      return {
        isVerified: false,
        login: githubLogin,
        hasWriteAccess: false,
        verifiedAt: new Date(),
      };
    }

    // Verify the login matches (security check)
    const isVerified =
      data.user.login.toLowerCase() === githubLogin.toLowerCase();

    // Check if user has write or admin access
    // Permissions: 'read', 'write', 'admin', 'none'
    const hasWriteAccess = ["admin", "write"].includes(data.permission);

    const result: ReviewerAuth = {
      isVerified,
      login: data.user.login,
      hasWriteAccess,
      verifiedAt: new Date(),
    };

    // Cache successful result
    authCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  } catch (error) {
    // Issue #29: Never log tokens - sanitize error logging
    console.error("Failed to verify reviewer authorization:", {
      reviewer: githubLogin,
      repo: `${repoOwner}/${repoName}`,
      error: error instanceof Error ? error.message : String(error),
      // Token explicitly omitted for security
    });

    // On error, return unverified status (fail secure)
    // Don't cache errors to allow retry
    return {
      isVerified: false,
      login: githubLogin,
      hasWriteAccess: false,
      verifiedAt: new Date(),
    };
  }
}
