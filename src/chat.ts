import { OpenAI, AzureOpenAI } from 'openai';
import log from './log.js';

export class Chat {
  private openai: OpenAI | AzureOpenAI;
  private isAzure: boolean;
  private isGithubModels: boolean;

  constructor(apikey: string) {
    this.isAzure = Boolean(process.env.AZURE_API_VERSION && process.env.AZURE_DEPLOYMENT);

    this.isGithubModels = process.env.USE_GITHUB_MODELS === 'true';

    if (this.isAzure) {
      // Azure OpenAI configuration
      this.openai = new AzureOpenAI({
        apiKey: apikey,
        endpoint: process.env.OPENAI_API_ENDPOINT || '',
        apiVersion: process.env.AZURE_API_VERSION || '',
        deployment: process.env.AZURE_DEPLOYMENT || '',
      });
    } else {
      // Standard OpenAI configuration
      this.openai = new OpenAI({
        apiKey: apikey,
        baseURL: this.isGithubModels
          ? 'https://models.github.ai/inference'
          : process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1',
      });
    }
  }

  // Detect if model requires Responses API (GPT-5.1+ and GPT-5.2+ models)
  private isReasoningModel(model: string): boolean {
    const reasoningModels = [
      'gpt-5.1',
      'gpt-5.1-codex',
      'gpt-5.1-codex-mini',
      'gpt-5-pro',
      'gpt-5.2',
      'gpt-5.2-pro',
    ];
    return reasoningModels.some((m) => model.includes(m));
  }

  // Get valid verbosity for model (gpt-5.1-codex only supports 'medium')
  private getValidVerbosity(model: string): 'low' | 'medium' | 'high' {
    const requestedVerbosity = process.env.VERBOSITY;

    // Validate verbosity is a known value
    const validVerbosities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
    const typedVerbosity = validVerbosities.includes(
      requestedVerbosity as 'low' | 'medium' | 'high'
    )
      ? (requestedVerbosity as 'low' | 'medium' | 'high')
      : undefined;

    // gpt-5.1-codex only supports 'medium' verbosity
    if (model.includes('gpt-5.1-codex')) {
      if (typedVerbosity && typedVerbosity !== 'medium') {
        log.warn(
          `${model} only supports verbosity 'medium'. Ignoring VERBOSITY=${requestedVerbosity}`
        );
      }
      log.debug(`Using verbosity 'medium' for model '${model}'`);
      return 'medium';
    }

    // Other models support low, medium, high - default to medium for safety
    const verbosity = typedVerbosity || 'medium';
    log.debug(`Using verbosity '${verbosity}' for model '${model}'`);
    return verbosity;
  }

  private generatePrompt = (patch: string) => {
    const answerLanguage = process.env.LANGUAGE ? `Answer me in ${process.env.LANGUAGE},` : '';

    const basePrompt =
      process.env.PROMPT ||
      'Review the following code patch. Focus on potential bugs, risks, and improvements.';

    // Add conciseness instruction
    const styleInstruction = '\nBe concise. Prioritize clarity over perfect grammar.\n';

    const jsonFormatRequirement =
      '\nProvide your feedback in strict JSON format:\n' +
      '{\n' +
      '  "lgtm": boolean,\n' +
      '  "review_comment": string,\n' +
      '  "issues": [\n' +
      '    {"severity": "critical" | "warning" | "style" | "suggestion", "message": "brief issue description"}\n' +
      '  ],\n' +
      '  "details": string // detailed analysis with explanations\n' +
      '}\n' +
      'List all issues concisely in the issues array. Put detailed explanations in the details field.\n';

    return `${basePrompt}${styleInstruction}${jsonFormatRequirement} ${answerLanguage}:
    ${patch}
    `;
  };

  // Code review using Responses API (for GPT-5.1+ models)
  private async codeReviewWithResponsesAPI(
    patch: string,
    model: string
  ): Promise<{ lgtm: boolean; review_comment: string; issues: any[]; details: string }> {
    if (!patch) {
      return {
        lgtm: true,
        review_comment: '',
        issues: [],
        details: '',
      };
    }

    console.time('code-review-responses-api cost');

    const answerLanguage = process.env.LANGUAGE ? `Answer me in ${process.env.LANGUAGE}.` : '';

    const basePrompt =
      process.env.PROMPT ||
      'Review the following code patch. Focus on potential bugs, risks, and improvements.';

    // Add conciseness instruction
    const styleInstruction = ' Be concise. Prioritize clarity over perfect grammar.';

    const prompt = `${basePrompt}${styleInstruction} ${answerLanguage}\n\nCode patch:\n${patch}`;

    try {
      const res = await this.openai.responses.create({
        model: model,
        input: prompt,
        reasoning: {
          effort: (process.env.REASONING_EFFORT as any) || 'medium',
        },
        text: {
          verbosity: this.getValidVerbosity(model),
          format: {
            type: 'json_schema',
            name: 'code_review_response',
            schema: {
              type: 'object',
              properties: {
                lgtm: {
                  type: 'boolean',
                  description: 'True if code is good to merge, false if concerns exist',
                },
                review_comment: {
                  type: 'string',
                  description: 'Legacy field for backward compatibility (can be empty)',
                },
                issues: {
                  type: 'array',
                  description: 'List of issues found in the code',
                  items: {
                    type: 'object',
                    properties: {
                      severity: {
                        type: 'string',
                        enum: ['critical', 'warning', 'style', 'suggestion'],
                        description: 'Severity level of the issue',
                      },
                      message: {
                        type: 'string',
                        description: 'Brief description of the issue',
                      },
                    },
                    required: ['severity', 'message'],
                    additionalProperties: false,
                  },
                },
                details: {
                  type: 'string',
                  description: 'Detailed analysis and explanations',
                },
              },
              required: ['lgtm', 'review_comment', 'issues', 'details'],
              additionalProperties: false,
            },
            strict: true,
          },
        },
      });

      console.timeEnd('code-review-responses-api cost');

      // Extract structured output from output array
      if (res.output && res.output.length > 0) {
        // Find the first message output item
        const messageOutput = res.output.find((item: any) => item.type === 'message') as any;
        if (
          messageOutput &&
          messageOutput.content &&
          Array.isArray(messageOutput.content) &&
          messageOutput.content.length > 0
        ) {
          const textContent = messageOutput.content.find((c: any) => c.type === 'text');
          if (textContent && textContent.text) {
            try {
              const parsed = JSON.parse(textContent.text);
              return {
                lgtm: parsed.lgtm || false,
                review_comment: parsed.review_comment || '',
                issues: parsed.issues || [],
                details: parsed.details || '',
              };
            } catch (parseError) {
              // JSON parse failed
            }
          }
        }
      }

      // Fallback: try output_text
      if (res.output_text) {
        try {
          const parsed = JSON.parse(res.output_text);
          return {
            lgtm: parsed.lgtm || false,
            review_comment: parsed.review_comment || '',
            issues: parsed.issues || [],
            details: parsed.details || '',
          };
        } catch (parseError) {
          // JSON parse failed, return as-is
          return {
            lgtm: false,
            review_comment: res.output_text,
            issues: [],
            details: res.output_text,
          };
        }
      }

      // Final fallback if output format is unexpected
      return {
        lgtm: false,
        review_comment: 'Error: Unable to parse Responses API output',
        issues: [],
        details: 'Error: Unable to parse Responses API output',
      };
    } catch (e) {
      console.timeEnd('code-review-responses-api cost');
      throw e;
    }
  }

  // Code review using Chat Completions API (for GPT-4o and earlier models)
  private async codeReviewWithChatAPI(
    patch: string,
    model: string
  ): Promise<{ lgtm: boolean; review_comment: string; issues: any[]; details: string }> {
    if (!patch) {
      return {
        lgtm: true,
        review_comment: '',
        issues: [],
        details: '',
      };
    }

    console.time('code-review-chat-api cost');
    const prompt = this.generatePrompt(patch);

    const res = await this.openai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: model,
      temperature: +(process.env.temperature || 0) || 1,
      top_p: +(process.env.top_p || 0) || 1,
      max_tokens: process.env.max_tokens ? +process.env.max_tokens : undefined,
      response_format: {
        type: 'json_object',
      },
    });

    console.timeEnd('code-review-chat-api cost');

    if (res.choices.length) {
      try {
        const json = JSON.parse(res.choices[0].message.content || '');
        // Ensure issues and details exist with defaults
        return {
          lgtm: json.lgtm || false,
          review_comment: json.review_comment || '',
          issues: json.issues || [],
          details: json.details || json.review_comment || '',
        };
      } catch (e) {
        return {
          lgtm: false,
          review_comment: res.choices[0].message.content || '',
          issues: [],
          details: res.choices[0].message.content || '',
        };
      }
    }

    return {
      lgtm: true,
      review_comment: '',
      issues: [],
      details: '',
    };
  }

  public codeReview = async (
    patch: string
  ): Promise<{
    lgtm: boolean;
    review_comment: string;
    issues: any[];
    details: string;
  }> => {
    if (!patch) {
      return {
        lgtm: true,
        review_comment: '',
        issues: [],
        details: '',
      };
    }

    const model =
      process.env.MODEL ||
      (this.isGithubModels ? 'openai/gpt-5.2-2025-12-11' : 'gpt-5.2-2025-12-11');

    // Use Responses API for GPT-5.1+ and GPT-5.2+ models, Chat Completions API for others
    if (this.isReasoningModel(model)) {
      return await this.codeReviewWithResponsesAPI(patch, model);
    } else {
      return await this.codeReviewWithChatAPI(patch, model);
    }
  };
}
