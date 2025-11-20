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
export declare function analyzeReviewSeverity(reviewComment: string): {
    critical: string[];
    warnings: string[];
    suggestions: string[];
};
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
export declare function verifyReviewerAuthorization(githubLogin: string, repoOwner: string, repoName: string, githubToken: string): Promise<ReviewerAuth>;
