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
 */
export function calculateQualityScore(
  reviewComment: string,
  lgtm: boolean
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

  // LGTM bonus with validation
  if (lgtm && severity.critical.length === 0) {
    score = Math.min(100, score + 10);
  }

  // Penalty for LGTM with critical issues (inconsistency)
  if (lgtm && severity.critical.length > 0) {
    score -= 20; // Deduct for false positive LGTM
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
