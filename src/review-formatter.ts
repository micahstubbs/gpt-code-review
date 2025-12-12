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

export function formatReviewComment(reviewData: ReviewData): string {
  const { issues, details, model } = reviewData;

  // Build issue summary
  let summary = '## Code Review Summary\n\n### Issues Found\n';

  if (issues.length === 0) {
    summary += 'No issues found ✓\n\n';
  } else {
    for (const issue of issues) {
      const severityLabel = issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1);
      summary += `- **${severityLabel}**: ${issue.message}\n`;
    }
    summary += '\n';
  }

  // Add collapsible details section
  summary += '<details>\n';
  summary += '<summary>Detailed Analysis</summary>\n\n';
  summary += details;
  summary += '\n\n</details>';

  // Add model identifier footer
  if (model) {
    summary += `\n\n---\n<sub>Reviewed by \`${model}\`</sub>`;
  }

  return summary;
}
