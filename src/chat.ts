import { OpenAI, AzureOpenAI } from 'openai';

export class Chat {
  private openai: OpenAI | AzureOpenAI;
  private isAzure: boolean;
  private isGithubModels: boolean;

  constructor(apikey: string) {
    this.isAzure = Boolean(
        process.env.AZURE_API_VERSION && process.env.AZURE_DEPLOYMENT,
    );

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
        baseURL: this.isGithubModels ? 'https://models.github.ai/inference' : process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1',
      });
    }
  }

  // Detect if model requires Responses API (GPT-5.1+ models)
  private isReasoningModel(model: string): boolean {
    const reasoningModels = ['gpt-5.1', 'gpt-5.1-codex', 'gpt-5.1-codex-mini', 'gpt-5-pro'];
    return reasoningModels.some(m => model.includes(m));
  }

  private generatePrompt = (patch: string) => {
    const answerLanguage = process.env.LANGUAGE
        ? `Answer me in ${process.env.LANGUAGE},`
        : '';

    const userPrompt = process.env.PROMPT || 'Please review the following code patch. Focus on potential bugs, risks, and improvement suggestions.';

    const jsonFormatRequirement = '\nProvide your feedback in a strict JSON format with the following structure:\n' +
        '{\n' +
        '  "lgtm": boolean, // true if the code looks good to merge, false if there are concerns\n' +
        '  "review_comment": string // Your detailed review comments. You can use markdown syntax in this string, but the overall response must be a valid JSON\n' +
        '}\n' +
        'Ensure your response is a valid JSON object.\n';

    return `${userPrompt}${jsonFormatRequirement} ${answerLanguage}:
    ${patch}
    `;
  };

  // Code review using Responses API (for GPT-5.1+ models)
  private async codeReviewWithResponsesAPI(
    patch: string,
    model: string
  ): Promise<{ lgtm: boolean, review_comment: string }> {
    if (!patch) {
      return {
        lgtm: true,
        review_comment: ""
      };
    }

    console.time('code-review-responses-api cost');

    const answerLanguage = process.env.LANGUAGE
        ? `Answer me in ${process.env.LANGUAGE}.`
        : '';

    const userPrompt = process.env.PROMPT || 'Please review the following code patch. Focus on potential bugs, risks, and improvement suggestions.';

    const prompt = `${userPrompt} ${answerLanguage}\n\nCode patch:\n${patch}`;

    try {
      const res = await this.openai.responses.create({
        model: model,
        input: prompt,
        reasoning: {
          effort: (process.env.REASONING_EFFORT as any) || 'medium'
        },
        text: {
          verbosity: (process.env.VERBOSITY as any) || 'medium',
          format: {
            type: 'json_schema',
            name: 'code_review_response',
            schema: {
              type: "object",
              properties: {
                lgtm: {
                  type: "boolean",
                  description: "True if the code looks good to merge, false if there are concerns"
                },
                review_comment: {
                  type: "string",
                  description: "Detailed review comments in markdown format"
                }
              },
              required: ["lgtm", "review_comment"],
              additionalProperties: false
            },
            strict: true
          }
        }
      });

      console.timeEnd('code-review-responses-api cost');

      // Extract structured output from output array
      if (res.output && res.output.length > 0) {
        // Find the first message output item
        const messageOutput = res.output.find((item: any) => item.type === 'message') as any;
        if (messageOutput && messageOutput.content && Array.isArray(messageOutput.content) && messageOutput.content.length > 0) {
          const textContent = messageOutput.content.find((c: any) => c.type === 'text');
          if (textContent && textContent.text) {
            try {
              const parsed = JSON.parse(textContent.text);
              return parsed as { lgtm: boolean, review_comment: string };
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
          return parsed as { lgtm: boolean, review_comment: string };
        } catch (parseError) {
          // JSON parse failed, return as-is
          return {
            lgtm: false,
            review_comment: res.output_text
          };
        }
      }

      // Final fallback if output format is unexpected
      return {
        lgtm: false,
        review_comment: "Error: Unable to parse Responses API output"
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
  ): Promise<{ lgtm: boolean, review_comment: string }> {
    if (!patch) {
      return {
        lgtm: true,
        review_comment: ""
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
        type: "json_object"
      },
    });

    console.timeEnd('code-review-chat-api cost');

    if (res.choices.length) {
      try {
        const json = JSON.parse(res.choices[0].message.content || "");
        return json;
      } catch (e) {
        return {
          lgtm: false,
          review_comment: res.choices[0].message.content || ""
        };
      }
    }

    return {
      lgtm: true,
      review_comment: ""
    };
  }

  public codeReview = async (patch: string): Promise<{ lgtm: boolean, review_comment: string }> => {
    if (!patch) {
      return {
        lgtm: true,
        review_comment: ""
      };
    }

    const model = process.env.MODEL || (this.isGithubModels ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');

    // Use Responses API for GPT-5.1+ models, Chat Completions API for others
    if (this.isReasoningModel(model)) {
      return await this.codeReviewWithResponsesAPI(patch, model);
    } else {
      return await this.codeReviewWithChatAPI(patch, model);
    }
  };
}
