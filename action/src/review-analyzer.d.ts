/**
 * Advanced code review analytics and scoring
 * This module provides sophisticated analysis of code reviews
 */
export interface ReviewMetrics {
    totalReviews: number;
    criticalIssues: number;
    warnings: number;
    suggestions: number;
    lgtmRate: number;
    averageReviewTime: number;
}
export interface CodeQualityScore {
    score: number;
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
 * Analyzes review content to extract severity levels
 * Uses pattern matching and NLP techniques to categorize issues
 *
 * Issue #15: Input validation and ReDoS protection
 * Issue #17: Deduplicates issues to prevent score gaming
 */
export declare function analyzeReviewSeverity(reviewComment: string): {
    critical: string[];
    warnings: string[];
    suggestions: string[];
};
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
export declare function calculateQualityScore(reviewComment: string, lgtm: boolean, reviewerAuth?: ReviewerAuth, _requiredApprovers?: number): CodeQualityScore;
/**
 * Generates metrics from a collection of reviews
 */
export declare function aggregateReviewMetrics(reviews: Array<{
    lgtm: boolean;
    reviewComment: string;
    reviewTime: number;
}>): ReviewMetrics;
/**
 * Clears the authorization cache
 * Exported for testing purposes
 */
export declare function clearAuthCache(): void;
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
export declare function verifyReviewerAuthorization(githubLogin: string, repoOwner: string, repoName: string, githubToken: string): Promise<ReviewerAuth>;
