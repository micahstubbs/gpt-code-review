/**
 * Review formatter - formats code review comments with issue summaries
 * and collapsible details sections
 */
export interface ReviewIssue {
    severity: 'critical' | 'warning' | 'style' | 'suggestion';
    message: string;
}
export interface ReviewData {
    issues: ReviewIssue[];
    details: string;
}
export declare function formatReviewComment(reviewData: ReviewData): string;
