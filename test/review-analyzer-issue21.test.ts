/**
 * Tests for Issue #21: Defensive defaults for undefined severity arrays
 *
 * This test file specifically tests the edge cases where analyzeReviewSeverity
 * might return undefined or null arrays, and ensures calculateQualityScore
 * handles these cases gracefully with defensive defaults.
 */

import * as reviewAnalyzerModule from '../src/review-analyzer';
import { ReviewerAuth } from '../src/review-analyzer';

describe('Issue #21: Defensive defaults for undefined severity arrays', () => {
  afterEach(() => {
    // Restore original function
    jest.restoreAllMocks();
  });

  test('calculateQualityScore handles undefined critical array', () => {
    // Mock analyzeReviewSeverity to return undefined critical
    jest.spyOn(reviewAnalyzerModule, 'analyzeReviewSeverity').mockReturnValue({
      critical: undefined as any,
      warnings: [],
      suggestions: []
    });

    const reviewComment = 'Test comment';

    // Should not throw - defensive defaults should handle this
    // Without defensive defaults, this would throw: "Cannot read property 'length' of undefined"
    let result: any;
    expect(() => {
      result = reviewAnalyzerModule.calculateQualityScore(reviewComment, false);
    }).not.toThrow();

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('calculateQualityScore handles null warnings array', () => {
    // Mock analyzeReviewSeverity to return null warnings
    jest.spyOn(reviewAnalyzerModule, 'analyzeReviewSeverity').mockReturnValue({
      critical: [],
      warnings: null as any,
      suggestions: []
    });

    const reviewComment = 'Test comment';

    let result: any;
    expect(() => {
      result = reviewAnalyzerModule.calculateQualityScore(reviewComment, false);
    }).not.toThrow();

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('calculateQualityScore handles undefined suggestions array', () => {
    // Mock analyzeReviewSeverity to return undefined suggestions
    jest.spyOn(reviewAnalyzerModule, 'analyzeReviewSeverity').mockReturnValue({
      critical: [],
      warnings: [],
      suggestions: undefined as any
    });

    const reviewComment = 'Test comment';

    let result: any;
    expect(() => {
      result = reviewAnalyzerModule.calculateQualityScore(reviewComment, false);
    }).not.toThrow();

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('calculateQualityScore handles all arrays as null', () => {
    // Mock analyzeReviewSeverity to return all null arrays
    jest.spyOn(reviewAnalyzerModule, 'analyzeReviewSeverity').mockReturnValue({
      critical: null as any,
      warnings: null as any,
      suggestions: null as any
    });

    const reviewComment = 'Test comment';

    let result: any;
    expect(() => {
      result = reviewAnalyzerModule.calculateQualityScore(reviewComment, false);
    }).not.toThrow();

    expect(result.score).toBe(100); // No issues = perfect score
    expect(result.category).toBe('excellent');
  });

  test('calculateQualityScore handles all arrays as undefined', () => {
    // Mock analyzeReviewSeverity to return all undefined arrays
    jest.spyOn(reviewAnalyzerModule, 'analyzeReviewSeverity').mockReturnValue({
      critical: undefined as any,
      warnings: undefined as any,
      suggestions: undefined as any
    });

    const reviewComment = 'Test comment';

    let result: any;
    expect(() => {
      result = reviewAnalyzerModule.calculateQualityScore(reviewComment, false);
    }).not.toThrow();

    expect(result.score).toBe(100);
    expect(result.category).toBe('excellent');
  });

  test('calculateQualityScore handles mixed undefined/null arrays with LGTM', () => {
    // Mock analyzeReviewSeverity to return mixed undefined/null
    jest.spyOn(reviewAnalyzerModule, 'analyzeReviewSeverity').mockReturnValue({
      critical: undefined as any,
      warnings: null as any,
      suggestions: []
    });

    const reviewComment = 'LGTM!';
    const validAuth: ReviewerAuth = {
      isVerified: true,
      login: 'reviewer',
      hasWriteAccess: true,
      verifiedAt: new Date()
    };

    let result: any;
    expect(() => {
      result = reviewAnalyzerModule.calculateQualityScore(reviewComment, true, validAuth);
    }).not.toThrow();

    // Should still work and apply LGTM bonus
    expect(result.score).toBe(100);
  });

  test('calculateQualityScore breakdown handles undefined arrays in filter operations', () => {
    // Mock analyzeReviewSeverity to return undefined arrays
    jest.spyOn(reviewAnalyzerModule, 'analyzeReviewSeverity').mockReturnValue({
      critical: undefined as any,
      warnings: undefined as any,
      suggestions: undefined as any
    });

    const reviewComment = 'Test comment';

    let result: any;
    expect(() => {
      result = reviewAnalyzerModule.calculateQualityScore(reviewComment, false);
    }).not.toThrow();

    // Breakdown should also not crash
    expect(result.breakdown).toBeDefined();
    expect(result.breakdown.security).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.maintainability).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.performance).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.testability).toBeGreaterThanOrEqual(0);
  });
});
