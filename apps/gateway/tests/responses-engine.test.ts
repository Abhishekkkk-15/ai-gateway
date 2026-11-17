import { describe, it, expect } from 'vitest';
import { ResponsesEngineService } from '../src/services/responses-engine.js';

describe('ResponsesEngineService multimodal mapping', () => {
  const engine = new ResponsesEngineService(null);

  it('passes through input_image as chat image_url parts', () => {
    const messages = engine.buildMessagesFromInput([
      { type: 'input_text', text: 'Describe this' },
      {
        type: 'input_image',
        image_url: 'data:image/png;base64,abc',
      },
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'user', content: 'Describe this' });
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
    ]);
  });

  it('preserves multimodal content arrays on message items', () => {
    const messages = engine.buildMessagesFromInput([
      {
        type: 'message',
        role: 'user',
        content: [
          { type: 'input_text', text: 'What is this?' },
          { type: 'input_image', image_url: { url: 'https://example.com/a.png' } },
        ],
      },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toEqual([
      { type: 'text', text: 'What is this?' },
      { type: 'image_url', image_url: { url: 'https://example.com/a.png' } },
    ]);
  });

  it('keeps text + image in a single multimodal content array', () => {
    const messages = engine.buildMessagesFromInput([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Caption this' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/4AAQ' } },
        ],
      },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toEqual([
      { type: 'text', text: 'Caption this' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/4AAQ' } },
    ]);
  });

  it('rejects file_id / input_file', () => {
    expect(() =>
      engine.buildMessagesFromInput([{ type: 'input_file', file_id: 'file-abc' }])
    ).toThrow(/file_id/);
  });
});
