import { OpenAI, AzureOpenAI } from 'openai';
import log from './log.js';
import { formatReviewComment, Severity } from './review-formatter.js';

/**
 * Expected structure for code review response
 */
interface CodeReviewResponse {
  lgtm: boolean;
  review_comment: string;
  issues: Array<{ severity: Severity; message: string }>;
  details: string;
}

/**
 * Extract and parse JSON from LLM response text.
 * Handles common cases like markdown code blocks, conversational wrapping, and partial JSON.
 *
 * @param text - Raw text response from LLM
 * @returns Parsed JSON object or null if extraction fails
 */
export function extractJsonFromText(text: string): CodeReviewResponse | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Strategy 1: Try direct JSON parse
  try {
    const parsed = JSON.parse(text.trim());
    if (isValidCodeReviewResponse(parsed)) {
      return parsed;
    }
  } catch {
    // Continue to other strategies
  }

  // Strategy 2: Extract from markdown code blocks (```json ... ``` or ``` ... ```)
  // Check all code blocks to find the first valid JSON response
  const codeBlockMatches = text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g);
  for (const match of codeBlockMatches) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (isValidCodeReviewResponse(parsed)) {
        return parsed;
      }
    } catch {
      // Try next code block
    }
  }

  // Strategy 3: Find JSON object boundaries ({ ... })
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    try {
      const jsonStr = text.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);
      if (isValidCodeReviewResponse(parsed)) {
        return parsed;
      }
    } catch {
      // Continue to other strategies
    }
  }

  // Strategy 4: Try to fix common JSON issues (trailing commas, single quotes)
  const cleanedText = text
    .replace(/,\s*}/g, '}') // Remove trailing commas before }
    .replace(/,\s*]/g, ']') // Remove trailing commas before ]
    .replace(/'/g, '"'); // Replace single quotes with double quotes

  const cleanJsonStart = cleanedText.indexOf('{');
  const cleanJsonEnd = cleanedText.lastIndexOf('}');
  if (cleanJsonStart !== -1 && cleanJsonEnd !== -1 && cleanJsonEnd > cleanJsonStart) {
    try {
      const jsonStr = cleanedText.substring(cleanJsonStart, cleanJsonEnd + 1);
      const parsed = JSON.parse(jsonStr);
      if (isValidCodeReviewResponse(parsed)) {
        return parsed;
      }
    } catch {
      // All strategies failed
    }
  }

  return null;
}

/**
 * Validate that an object has the expected CodeReviewResponse structure
 */
export function isValidCodeReviewResponse(obj: unknown): obj is CodeReviewResponse {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const response = obj as Record<string, unknown>;

  // lgtm must be boolean
  if (typeof response.lgtm !== 'boolean') {
    return false;
  }

  // issues must be an array (can be empty)
  if (!Array.isArray(response.issues)) {
    return false;
  }

  // Validate each issue has required structure
  const validSeverities = ['critical', 'warning', 'style', 'suggestion'];
  for (const issue of response.issues) {
    if (!issue || typeof issue !== 'object') {
      return false;
    }
    const issueObj = issue as Record<string, unknown>;
    if (typeof issueObj.severity !== 'string' || typeof issueObj.message !== 'string') {
      return false;
    }
    // Validate severity is one of the expected values
    if (!validSeverities.includes(issueObj.severity.toLowerCase())) {
      return false;
    }
  }

  return true;
}

/**
 * Normalize a parsed response to ensure all fields exist with proper defaults
 */
function normalizeCodeReviewResponse(parsed: Partial<CodeReviewResponse>): CodeReviewResponse {
  return {
    lgtm: parsed.lgtm ?? false,
    review_comment: parsed.review_comment ?? '',
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    details: parsed.details ?? parsed.review_comment ?? '',
  };
}

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

  // Detect if model supports structured outputs (JSON schema)
  // GPT-5.2 Pro and some other models don't support structured outputs
  private supportsStructuredOutputs(model: string): boolean {
    const noStructuredOutputModels = ['gpt-5.2-pro'];
    return !noStructuredOutputModels.some((m) => model.includes(m));
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
              const issues = parsed.issues || [];
              const details = parsed.details || parsed.review_comment || '';
              return {
                lgtm: parsed.lgtm || false,
                review_comment: formatReviewComment({ issues, details, model }),
                issues,
                details,
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
          const issues = parsed.issues || [];
          const details = parsed.details || parsed.review_comment || '';
          return {
            lgtm: parsed.lgtm || false,
            review_comment: formatReviewComment({ issues, details, model }),
            issues,
            details,
          };
        } catch (parseError) {
          // JSON parse failed, return as-is with raw text in details
          return {
            lgtm: false,
            review_comment: formatReviewComment({ issues: [], details: res.output_text, model }),
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

  // Code review using Responses API WITHOUT structured outputs (for models like GPT-5.2 Pro)
  // Uses plain text format with JSON instructions in prompt, then extracts JSON from response
  private async codeReviewWithResponsesAPINoSchema(
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

    console.time('code-review-responses-api-no-schema cost');

    const answerLanguage = process.env.LANGUAGE ? `Answer me in ${process.env.LANGUAGE}.` : '';

    const basePrompt =
      process.env.PROMPT ||
      'Review the following code patch. Focus on potential bugs, risks, and improvements.';

    // Add conciseness instruction and explicit JSON format requirement
    const styleInstruction = ' Be concise. Prioritize clarity over perfect grammar.';

    const jsonFormatInstruction = `

IMPORTANT: Respond with ONLY a valid JSON object in this exact format (no markdown, no explanation before or after):
{
  "lgtm": boolean,
  "review_comment": "brief summary",
  "issues": [{"severity": "critical|warning|style|suggestion", "message": "description"}],
  "details": "detailed analysis"
}`;

    const prompt = `${basePrompt}${styleInstruction}${jsonFormatInstruction} ${answerLanguage}\n\nCode patch:\n${patch}`;

    try {
      const res = await this.openai.responses.create({
        model: model,
        input: prompt,
        reasoning: {
          effort: (process.env.REASONING_EFFORT as any) || 'medium',
        },
        text: {
          verbosity: this.getValidVerbosity(model),
          // No format specification - use plain text
        },
      });

      console.timeEnd('code-review-responses-api-no-schema cost');

      // Extract text from response
      let responseText = '';

      if (res.output && res.output.length > 0) {
        const messageOutput = res.output.find((item: any) => item.type === 'message') as any;
        if (
          messageOutput &&
          messageOutput.content &&
          Array.isArray(messageOutput.content) &&
          messageOutput.content.length > 0
        ) {
          const textContent = messageOutput.content.find((c: any) => c.type === 'text');
          if (textContent && textContent.text) {
            responseText = textContent.text;
          }
        }
      }

      // Fallback to output_text
      if (!responseText && res.output_text) {
        responseText = res.output_text;
      }

      if (!responseText) {
        log.warn('No text content in Responses API response');
        return {
          lgtm: false,
          review_comment: 'Error: No response from API',
          issues: [],
          details: 'Error: No response from API',
        };
      }

      // Use robust JSON extraction
      const extracted = extractJsonFromText(responseText);

      if (extracted) {
        log.debug('Successfully extracted JSON from response');
        const normalized = normalizeCodeReviewResponse(extracted);
        return {
          ...normalized,
          review_comment: formatReviewComment({ issues: normalized.issues, details: normalized.details, model }),
        };
      }

      // If JSON extraction failed, return the raw text as the review
      log.warn('Failed to extract JSON from response, using raw text');
      return {
        lgtm: false,
        review_comment: formatReviewComment({ issues: [], details: responseText, model }),
        issues: [],
        details: responseText,
      };
    } catch (e) {
      console.timeEnd('code-review-responses-api-no-schema cost');
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
        const issues = json.issues || [];
        const details = json.details || json.review_comment || '';
        return {
          lgtm: json.lgtm || false,
          review_comment: formatReviewComment({ issues, details, model }),
          issues,
          details,
        };
      } catch (e) {
        const rawContent = res.choices[0].message.content || '';
        return {
          lgtm: false,
          review_comment: formatReviewComment({ issues: [], details: rawContent, model }),
          issues: [],
          details: rawContent,
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
      // Check if model supports structured outputs (JSON schema)
      if (this.supportsStructuredOutputs(model)) {
        return await this.codeReviewWithResponsesAPI(patch, model);
      } else {
        // Use fallback method with JSON extraction for models without structured output support
        log.debug(`Model ${model} does not support structured outputs, using JSON extraction`);
        return await this.codeReviewWithResponsesAPINoSchema(patch, model);
      }
    } else {
      return await this.codeReviewWithChatAPI(patch, model);
    }
  };
}
