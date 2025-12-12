import { Severity } from './review-formatter.js';
/**
 * Expected structure for code review response
 */
interface CodeReviewResponse {
    lgtm: boolean;
    review_comment: string;
    issues: Array<{
        severity: Severity;
        message: string;
    }>;
    details: string;
}
/**
 * Extract and parse JSON from LLM response text.
 * Handles common cases like markdown code blocks, conversational wrapping, and partial JSON.
 *
 * @param text - Raw text response from LLM
 * @returns Parsed JSON object or null if extraction fails
 */
export declare function extractJsonFromText(text: string): CodeReviewResponse | null;
/**
 * Validate that an object has the expected CodeReviewResponse structure
 */
export declare function isValidCodeReviewResponse(obj: unknown): obj is CodeReviewResponse;
export declare class Chat {
    private openai;
    private isAzure;
    private isGithubModels;
    private model;
    constructor(apikey: string);
    getModel(): string;
    private isReasoningModel;
    private supportsStructuredOutputs;
    private getValidVerbosity;
    private generatePrompt;
    private codeReviewWithResponsesAPI;
    private codeReviewWithResponsesAPINoSchema;
    private codeReviewWithChatAPI;
    codeReview: (patch: string) => Promise<{
        lgtm: boolean;
        review_comment: string;
        issues: any[];
        details: string;
    }>;
}
export {};
