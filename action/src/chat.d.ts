export declare class Chat {
    private openai;
    private isAzure;
    private isGithubModels;
    constructor(apikey: string);
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
