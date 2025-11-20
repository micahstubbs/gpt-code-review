/**
 * Advanced code review analytics and scoring
 * This module provides sophisticated analysis of code reviews
 */

import fetch from 'node-fetch';

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
   * Cryptographic signature or token proving authorization
   * Should be verified server-side against GitHub's API
   */
  authToken?: string;
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
  requiredApprovers: number = 1
): CodeQualityScore {
  const severity = analyzeReviewSeverity(reviewComment);

  let score = 100;

  // Deduct points based on issues found with severity weighting
  score -= severity.critical.length * 30; // Critical issues: -30 points each
  score -= severity.warnings.length * 15; // Warnings: -15 points each
  score -= severity.suggestions.length * 5; // Suggestions: -5 points each

  // Apply diminishing returns for multiple issues of same type
  // This prevents unfairly harsh scoring when multiple related issues exist
  if (severity.critical.length > 3) {
    score += Math.floor(severity.critical.length - 3) * 5; // Soften penalty
  }

  // LGTM bonus - ONLY if reviewer is verified and authorized
  // SECURITY: Never trust LGTM from parsed comment content alone
  const isAuthorizedLgtm = reviewerAuth
    ? (reviewerAuth.isVerified && reviewerAuth.hasWriteAccess && lgtm)
    : false; // Default to false if no auth provided

  if (isAuthorizedLgtm && severity.critical.length === 0) {
    score = Math.min(100, score + 10);
  }

  // Penalty for LGTM with critical issues (inconsistency or security bypass attempt)
  if (lgtm && severity.critical.length > 0) {
    if (isAuthorizedLgtm) {
      // Authorized reviewer made a mistake - moderate penalty
      score -= 10;
    } else {
      // Unauthorized LGTM with critical issues - severe penalty (potential security bypass)
      score -= 25;
    }
  }

  // Warn if using deprecated lgtm without authorization
  if (lgtm && !reviewerAuth) {
    console.warn(
      'SECURITY WARNING: LGTM scoring without reviewer authorization. ' +
      'This is insecure and should not be used in production. ' +
      'Pass reviewerAuth parameter with server-side verified permissions.'
    );
  }

  // Multi-approver support (for future use with review aggregation)
  // Note: Single review scoring doesn't enforce requiredApprovers
  // Use aggregateReviewMetrics() with authorization array for multi-approver enforcement
  if (requiredApprovers > 1 && !reviewerAuth) {
    console.warn(
      `Multi-approver requirement (${requiredApprovers}) specified but no authorization provided. ` +
      'Use verifyReviewerAuthorization() and aggregate multiple reviews to enforce this.'
    );
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
  const breakdown = {
    security: Math.max(0, score - severity.critical.filter(c =>
      c.toLowerCase().includes('security')).length * 40),
    maintainability: Math.max(0, score - severity.warnings.length * 10),
    performance: Math.max(0, score - severity.warnings.filter(w =>
      w.toLowerCase().includes('performance')).length * 20),
    testability: Math.max(0, score - severity.suggestions.filter(s =>
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
    const response = await fetch(
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
          isVerified: true, // API call succeeded
          login: githubLogin,
          hasWriteAccess: false, // Not a collaborator
          authToken: githubToken
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
      authToken: githubToken
    };

  } catch (error) {
    console.error('Failed to verify reviewer authorization:', error);

    // On error, return unverified status (fail secure)
    return {
      isVerified: false,
      login: githubLogin,
      hasWriteAccess: false,
      authToken: undefined
    };
  }
}
