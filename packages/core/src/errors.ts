import type { OpenAIErrorEnvelope } from './types.js';

export class GatewayError extends Error {
  public statusCode: number;
  public errorType: string;
  public errorCode?: string | null;

  constructor(message: string, statusCode = 500, errorType = 'internal_error', errorCode: string | null = null) {
    super(message);
    this.name = 'GatewayError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.errorCode = errorCode;
  }

  toOpenAIEnvelope(): OpenAIErrorEnvelope {
    return {
      error: {
        message: this.message,
        type: this.errorType,
        param: null,
        code: this.errorCode ?? null,
      },
    };
  }
}

export function createOpenAIError(
  message: string,
  statusCode = 500,
  errorType = 'api_error',
  code?: string | null
): OpenAIErrorEnvelope {
  return {
    error: {
      message,
      type: errorType,
      param: null,
      code: code ?? null,
    },
  };
}
