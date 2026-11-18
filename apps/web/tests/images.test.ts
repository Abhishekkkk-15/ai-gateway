import { describe, expect, it } from 'vitest';
import {
  extractGeneratedImages,
  extensionForMime,
  formatBytes,
} from '../src/lib/images.js';

describe('extractGeneratedImages', () => {
  it('reads OpenAI URL payloads', () => {
    const images = extractGeneratedImages({
      created: 1,
      data: [{ url: 'https://example.com/image.png', revised_prompt: 'A red fox' }],
    });

    expect(images).toHaveLength(1);
    expect(images[0].src).toBe('https://example.com/image.png');
    expect(images[0].source).toBe('url');
    expect(images[0].revisedPrompt).toBe('A red fox');
  });

  it('reads base64 payloads as data URLs', () => {
    const images = extractGeneratedImages({
      data: [{ b64_json: 'abc123' }],
    });

    expect(images).toHaveLength(1);
    expect(images[0].src).toBe('data:image/png;base64,abc123');
    expect(images[0].source).toBe('base64');
    expect(images[0].mimeType).toBe('image/png');
  });

  it('preserves existing data URLs', () => {
    const images = extractGeneratedImages({
      images: [{ url: 'data:image/webp;base64,xyz' }],
    });

    expect(images[0].src).toBe('data:image/webp;base64,xyz');
    expect(images[0].mimeType).toBe('image/webp');
  });

  it('reads Cloudflare-style nested result.image', () => {
    const images = extractGeneratedImages({
      result: { image: 'cloudflare-base64' },
      success: true,
    });

    expect(images).toHaveLength(1);
    expect(images[0].src).toBe('data:image/png;base64,cloudflare-base64');
  });

  it('deduplicates repeated images', () => {
    const images = extractGeneratedImages({
      data: [{ url: 'https://example.com/same.png' }],
      images: [{ url: 'https://example.com/same.png' }],
    });

    expect(images).toHaveLength(1);
  });

  it('returns an empty list for unknown payloads', () => {
    expect(extractGeneratedImages(null)).toEqual([]);
    expect(extractGeneratedImages({ success: true })).toEqual([]);
  });
});

describe('formatBytes', () => {
  it('formats byte sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('extensionForMime', () => {
  it('maps common image mime types', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(extensionForMime('image/webp')).toBe('webp');
    expect(extensionForMime('image/gif')).toBe('gif');
    expect(extensionForMime('image/png')).toBe('png');
  });
});
