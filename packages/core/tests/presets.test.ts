import { describe, it, expect } from 'vitest';
import { OPENAI_COMPATIBLE_PRESETS, getOpenAICompatiblePreset } from '../src/presets.js';

describe('OpenAI-compatible presets', () => {
  it('includes groq and nvidia with openai-compatible adapterType', () => {
    const groq = getOpenAICompatiblePreset('groq');
    const nvidia = getOpenAICompatiblePreset('nvidia');

    expect(groq).toBeDefined();
    expect(groq?.adapterType).toBe('openai-compatible');
    expect(groq?.defaultBaseUrl).toBe('https://api.groq.com/openai/v1');

    expect(nvidia).toBeDefined();
    expect(nvidia?.adapterType).toBe('openai-compatible');
    expect(nvidia?.defaultBaseUrl).toBe('https://integrate.api.nvidia.com/v1');
  });

  it('lists all presets with unique ids', () => {
    const ids = OPENAI_COMPATIBLE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('openai');
    expect(ids).toContain('deepseek');
  });
});
