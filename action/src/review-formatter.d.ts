/**
 * Review formatter - formats code review comments with issue summaries
 * and collapsible details sections
 */
export type Severity = 'critical' | 'warning' | 'style' | 'suggestion';
export interface ReviewIssue {
    severity: Severity;
    message: string;
}
export interface ReviewData {
    issues: ReviewIssue[];
    details: string;
    model?: string;
}
export declare function formatReviewComment(reviewData: ReviewData): string;
