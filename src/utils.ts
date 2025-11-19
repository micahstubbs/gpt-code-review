/**
 * Utility functions for ChatGPT Code Review bot
 */

/**
 * Formats an error message for user-friendly display
 * @param error - The error object
 * @param context - Optional context about where the error occurred
 * @returns Formatted error message
 */
export function formatError(error: unknown, context?: string): string {
  const prefix = context ? `[${context}] ` : '';

  if (error instanceof Error) {
    return `${prefix}Error: ${error.message}`;
  }

  if (typeof error === 'string') {
    return `${prefix}Error: ${error}`;
  }

  return `${prefix}Unknown error occurred`;
}

/**
 * Safely parses JSON with fallback
 * @param jsonString - The JSON string to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    const parsed = JSON.parse(jsonString);
    return parsed as T;
  } catch (error) {
    console.error('JSON parse error:', formatError(error));
    console.error('Failed input:', truncateString(jsonString, 100));
    return fallback;
  }
}

/**
 * Validates that a value is a non-empty string
 * @param value - Value to validate
 * @param fieldName - Name of the field for error message
 * @returns The validated string
 * @throws Error if validation fails
 */
export function validateNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string, got ${typeof value}`);
  }

  if (value.trim().length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }

  return value;
}

/**
 * Truncates a string to a maximum length with ellipsis
 * @param str - The string to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated string
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }

  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Checks if a model is a reasoning model (GPT-5.1+)
 * @param modelName - The model name to check
 * @returns True if it's a reasoning model
 */
export function isReasoningModel(modelName: string): boolean {
  const reasoningModels = ['gpt-5.1', 'gpt-5.1-codex', 'gpt-5.1-codex-mini', 'gpt-5-pro'];
  return reasoningModels.some(model => modelName.includes(model));
}

/**
 * Validates environment variable is set
 * @param varName - Name of the environment variable
 * @returns The value if set
 * @throws Error if not set
 */
export function requireEnv(varName: string): string {
  const value = process.env[varName];

  if (!value) {
    throw new Error(`Required environment variable ${varName} is not set`);
  }

  return value;
}

/**
 * Gets environment variable with default value
 * @param varName - Name of the environment variable
 * @param defaultValue - Default value if not set
 * @returns The value or default
 */
export function getEnv(varName: string, defaultValue: string): string {
  return process.env[varName] || defaultValue;
}
