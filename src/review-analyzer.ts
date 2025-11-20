/**
 * Advanced code review analytics and scoring
 * This module provides sophisticated analysis of code reviews
 */

// Using native fetch (Node 18+) - types from @types/node

/**
 * Scoring configuration constants
 * Extracted to module-level for maintainability and testability
 */
const SCORING_CONFIG = {
  CRITICAL_BASE_WEIGHT: 30,
  CRITICAL_THRESHOLD: 3,
  // Softening factor: 5/30 = 0.1667 (approximately 16.67% reduction)
  // Results in softened weight of 25 (30 - 5)
  SOFTEN_FACTOR: 5 / 30,
  WARNING_WEIGHT: 15,
  SUGGESTION_WEIGHT: 5,
  LGTM_BONUS: 10,
  LGTM_WITH_CRITICALS_PENALTY: 10
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
  category: 'excellent' | 'good' | 'needs-improvement' | 'critical';
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
 * Analyzes review content to extract severity levels
 * Uses pattern matching and NLP techniques to categorize issues
 */
export function analyzeReviewSeverity(reviewComment: string): {
  critical: string[];
  warnings: string[];
  suggestions: string[];
} {
  // Input validation (Issue #15)
  if (typeof reviewComment !== 'string') {
    throw new Error('Invalid input: reviewComment must be a string');
  }

  if (reviewComment.trim() === '') {
    throw new Error('Invalid input: reviewComment cannot be empty');
  }

  if (reviewComment.length > 10000) {
    throw new Error('Invalid input: reviewComment exceeds maximum length of 10000 characters');
  }

  const lineCount = reviewComment.split('\n').length;
  if (lineCount > 1000) {
    throw new Error('Invalid input: reviewComment exceeds maximum of 1000 lines');
  }

  const critical: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Split by lines and analyze each
  const lines = reviewComment.split('\n').filter(l => l.trim());

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Critical issues - security, bugs, breaking changes
    if (
      lowerLine.includes('security') ||
      lowerLine.includes('vulnerability') ||
      lowerLine.includes('sql injection') ||
      lowerLine.includes('xss') ||
      lowerLine.includes('critical bug') ||
      lowerLine.includes('data loss')
    ) {
      critical.push(line);
    }
    // Warnings - potential issues, code smells
    else if (
      lowerLine.includes('warning') ||
      lowerLine.includes('potential issue') ||
      lowerLine.includes('might fail') ||
      lowerLine.includes('edge case') ||
      lowerLine.includes('race condition')
    ) {
      warnings.push(line);
    }
    // Suggestions - improvements, best practices
    else if (
      lowerLine.includes('consider') ||
      lowerLine.includes('suggest') ||
      lowerLine.includes('recommend') ||
      lowerLine.includes('could be') ||
      lowerLine.includes('better to')
    ) {
      suggestions.push(line);
    }
  }

  return { critical, warnings, suggestions };
}

/**
 * Calculates code quality score based on review metrics
 * Uses weighted scoring algorithm with adaptive thresholds
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
  // SECURITY: Enforce authorization when LGTM is claimed
  if (lgtm && !reviewerAuth) {
    throw new Error(
      'SECURITY ERROR: LGTM requires verified reviewer authorization. ' +
      'Call verifyReviewerAuthorization() first and pass the result as reviewerAuth parameter.'
    );
  }

  // Additional check: even with reviewerAuth, verify it's actually verified
  if (lgtm && reviewerAuth && !reviewerAuth.isVerified) {
    throw new Error(
      'SECURITY ERROR: LGTM requires isVerified=true in reviewerAuth. ' +
      'The provided authorization is not verified.'
    );
  }

  const severity = analyzeReviewSeverity(reviewComment);

  // Defensive defaults: Protect against undefined/null arrays from analyzeReviewSeverity
  // Issue #21: Add defensive defaults for undefined severity arrays
  // Also guard against severity itself being null/undefined (defense in depth)
  const { critical = [], warnings = [], suggestions = [] } = severity ?? {};

  let score = 100;

  // Calculate critical penalty with diminishing returns built in
  // First 3 criticals: full penalty (30 points each)
  // Additional criticals: softened penalty (25 points each - 16.67% reduction)
  // This prevents unfairly harsh scoring when multiple related issues exist
  const criticalCount = critical.length;
  const CRITICAL_SOFTENED_WEIGHT = Math.round(
    SCORING_CONFIG.CRITICAL_BASE_WEIGHT * (1 - SCORING_CONFIG.SOFTEN_FACTOR)
  );

  const criticalPenalty =
    Math.min(criticalCount, SCORING_CONFIG.CRITICAL_THRESHOLD) * SCORING_CONFIG.CRITICAL_BASE_WEIGHT +
    Math.max(0, criticalCount - SCORING_CONFIG.CRITICAL_THRESHOLD) * CRITICAL_SOFTENED_WEIGHT;

  // Deduct points based on issues found with severity weighting
  score -= criticalPenalty; // Critical issues with diminishing returns
  score -= warnings.length * SCORING_CONFIG.WARNING_WEIGHT;
  score -= suggestions.length * SCORING_CONFIG.SUGGESTION_WEIGHT;

  // LGTM bonus - ONLY if reviewer is verified and authorized
  // SECURITY: Never trust LGTM from parsed comment content alone
  const isAuthorizedLgtm = reviewerAuth
    ? (reviewerAuth.isVerified && reviewerAuth.hasWriteAccess && lgtm)
    : false; // Default to false if no auth provided

  if (isAuthorizedLgtm && critical.length === 0) {
    score = Math.min(100, score + SCORING_CONFIG.LGTM_BONUS);
  }

  // Penalty for LGTM with critical issues (authorized reviewer made a mistake)
  if (isAuthorizedLgtm && critical.length > 0) {
    score -= SCORING_CONFIG.LGTM_WITH_CRITICALS_PENALTY;
  }

  // Ensure score is in valid range
  score = Math.max(0, Math.min(100, score));

  // Categorize
  let category: CodeQualityScore['category'];
  if (score >= 90) category = 'excellent';
  else if (score >= 70) category = 'good';
  else if (score >= 50) category = 'needs-improvement';
  else category = 'critical';

  // Simple breakdown (could be enhanced with more sophisticated analysis)
  // Issue #11: Each dimension starts from 100 and deducts only relevant issues
  const breakdown = {
    security: Math.max(0, 100 - critical.filter(c =>
      c.toLowerCase().includes('security')).length * 40),
    maintainability: Math.max(0, 100 - warnings.length * 10),
    performance: Math.max(0, 100 - warnings.filter(w =>
      w.toLowerCase().includes('performance')).length * 20),
    testability: Math.max(0, 100 - suggestions.filter(s =>
      s.toLowerCase().includes('test')).length * 10),
  };

  return {
    score,
    category,
    breakdown
  };
}

/**
 * Generates metrics from a collection of reviews
 */
export function aggregateReviewMetrics(
  reviews: Array<{ lgtm: boolean; reviewComment: string; reviewTime: number }>
): ReviewMetrics {
  let criticalIssues = 0;
  let warnings = 0;
  let suggestions = 0;
  let lgtmCount = 0;
  let totalTime = 0;

  for (const review of reviews) {
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
    averageReviewTime: reviews.length > 0 ? totalTime / reviews.length : 0
  };
}

/**
 * Verifies reviewer authorization from GitHub API
 * SECURITY: This function MUST query GitHub's API server-side to verify permissions.
 * Never trust client-provided authorization data.
 *
 * @param githubLogin - Reviewer's GitHub login
 * @param repoOwner - Repository owner
 * @param repoName - Repository name
 * @param githubToken - GitHub API token with repo permissions
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
  try {
    // Query GitHub API to verify reviewer permissions
    // GET /repos/{owner}/{repo}/collaborators/{username}/permission
    const response = await globalThis.fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/collaborators/${githubLogin}/permission`,
      {
        method: 'GET',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ChatGPT-CodeReview-Bot'
        }
      }
    );

    if (!response.ok) {
      // If user is not a collaborator, GitHub returns 404
      if (response.status === 404) {
        return {
          isVerified: false, // User is not a collaborator
          login: githubLogin,
          hasWriteAccess: false,
          verifiedAt: new Date()
        };
      }

      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { permission: string; user: { login: string } };

    // Verify the login matches (security check)
    const isVerified = data.user.login.toLowerCase() === githubLogin.toLowerCase();

    // Check if user has write or admin access
    // Permissions: 'read', 'write', 'admin', 'none'
    const hasWriteAccess = ['admin', 'write'].includes(data.permission);

    return {
      isVerified,
      login: data.user.login,
      hasWriteAccess,
      verifiedAt: new Date()
    };

  } catch (error) {
    console.error('Failed to verify reviewer authorization:', error);

    // On error, return unverified status (fail secure)
    return {
      isVerified: false,
      login: githubLogin,
      hasWriteAccess: false,
      verifiedAt: new Date()
    };
  }
}
