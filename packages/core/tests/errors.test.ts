import { describe, it, expect } from 'vitest';
import {
  createOpenAIError,
  createUnsupportedResourceError,
  createStatelessUnsupportedError,
} from '../src/errors.js';

describe('error helpers', () => {
  it('createUnsupportedResourceError uses 501 + unsupported_resource', () => {
    const envelope = createUnsupportedResourceError('Batches');
    expect(envelope.error.code).toBe('unsupported_resource');
    expect(envelope.error.type).toBe('invalid_request_error');
    expect(envelope.error.message).toContain('Batches');
  });

  it('createStatelessUnsupportedError uses 400 + stateless_unsupported', () => {
    const envelope = createStatelessUnsupportedError('No store');
    expect(envelope.error.code).toBe('stateless_unsupported');
    expect(envelope.error.message).toBe('No store');
  });

  it('createOpenAIError preserves custom code', () => {
    const envelope = createOpenAIError('oops', 404, 'invalid_request_error', 'model_not_found');
    expect(envelope.error.code).toBe('model_not_found');
  });
});
