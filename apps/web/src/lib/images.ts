export interface RenderableImage {
  /** A ready-to-use `src` value (https URL or `data:` URL). */
  src: string;
  mimeType: string;
  source: 'url' | 'base64';
  revisedPrompt?: string;
}

type UnknownRecord = Record<string, unknown>;

const MAX_IMAGES = 8;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : null;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function mimeFromDataUrl(value: string): string {
  const match = /^data:(image\/[a-z0-9.+-]+)[;,]/i.exec(value);
  return match ? match[1] : 'image/png';
}

function toImage(value: unknown, revisedPrompt?: string): RenderableImage | null {
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;

    if (raw.startsWith('data:image/')) {
      return {
        src: raw,
        mimeType: mimeFromDataUrl(raw),
        source: 'base64',
        revisedPrompt,
      };
    }

    if (/^https?:\/\//i.test(raw)) {
      return { src: raw, mimeType: 'image/png', source: 'url', revisedPrompt };
    }

    // Raw base64 payload from providers such as Cloudflare Workers AI.
    return {
      src: `data:image/png;base64,${raw}`,
      mimeType: 'image/png',
      source: 'base64',
      revisedPrompt,
    };
  }

  const record = asRecord(value);
  if (!record) return null;

  const prompt =
    revisedPrompt ??
    firstString(record.revised_prompt, record.revisedPrompt, record.prompt);

  const direct = firstString(record.b64_json, record.b64Json, record.base64, record.base64Data);
  if (direct) return toImage(direct, prompt);

  const url = firstString(record.url, record.image_url, record.imageUrl, record.href);
  if (url) return toImage(url, prompt);

  // Some providers nest the payload, e.g. `{ image: { url } }`.
  const nested = asRecord(record.image) ?? asRecord(record.data);
  if (nested) return toImage(nested, prompt);

  const flat = firstString(record.image, record.data);
  if (flat) return toImage(flat, prompt);

  return null;
}

function collect(value: unknown, out: RenderableImage[]) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = toImage(item);
      if (image) out.push(image);
    }
    return;
  }
  const image = toImage(value);
  if (image) out.push(image);
}

/**
 * Normalises the many shapes image providers return into renderable images.
 * Supports OpenAI (`data[].url` / `data[].b64_json`), Cloudflare
 * (`result.image` as base64), and generic `images[]` / `url` payloads.
 */
export function extractGeneratedImages(payload: unknown): RenderableImage[] {
  const record = asRecord(payload);
  if (!record) return [];

  const collected: RenderableImage[] = [];

  for (const key of ['data', 'images', 'output', 'artifacts']) {
    if (record[key] !== undefined) collect(record[key], collected);
  }

  const result = record.result;
  if (result !== undefined) {
    const resultRecord = asRecord(result);
    if (resultRecord) {
      collect(
        resultRecord.images ?? resultRecord.image ?? resultRecord.b64_json ?? resultRecord.url,
        collected
      );
    } else {
      collect(result, collected);
    }
  }

  if (collected.length === 0) {
    collect(record.url ?? record.b64_json ?? record.image, collected);
  }

  const seen = new Set<string>();
  const unique: RenderableImage[] = [];
  for (const image of collected) {
    if (seen.has(image.src)) continue;
    seen.add(image.src);
    unique.push(image);
    if (unique.length >= MAX_IMAGES) break;
  }
  return unique;
}

export function isSupportedImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read image file.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'png';
  }
}
