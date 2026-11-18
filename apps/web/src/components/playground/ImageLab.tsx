import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/api.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Textarea } from '../../components/ui/textarea.js';
import { Badge } from '../../components/ui/badge.js';
import { Field, FieldGroup, FieldLabel } from '../../components/ui/field.js';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group.js';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/alert.js';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '../../components/ui/empty.js';
import { Spinner } from '../../components/ui/spinner.js';
import { Skeleton } from '../../components/ui/skeleton.js';
import { ReactSelect, type SelectOption } from '../../components/ui/react-select.js';
import { InlineCode } from '../../components/ui/code-block.js';
import { cn } from '../../lib/utils.js';
import {
  extractGeneratedImages,
  formatBytes,
  isSupportedImageFile,
  readFileAsDataUrl,
  extensionForMime,
  type RenderableImage,
} from '../../lib/images.js';
import {
  AlertTriangle,
  Copy,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Info,
  ScanEye,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';

const IMAGE_PROMPT_SUGGESTIONS = [
  'A cinematic photo of a neon-lit Tokyo alley after rain',
  'Minimal isometric illustration of a floating data center',
  'A watercolor fox reading a book in a mossy forest',
];

const ANALYSIS_PROMPT_SUGGESTIONS = [
  'Describe this image in detail.',
  'Extract all visible text from this image.',
  'Suggest a short alt text and a marketing caption.',
];

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_SIZE_OPTIONS: SelectOption[] = [
  { label: '1024x1024 (Square 1:1)', value: '1024x1024' },
  { label: '1024x1792 (Portrait 9:16)', value: '1024x1792' },
  { label: '1792x1024 (Landscape 16:9)', value: '1792x1024' },
  { label: '512x512 (Fast 1:1)', value: '512x512' },
  { label: '256x256 (Thumbnail 1:1)', value: '256x256' },
];

const IMAGE_QUALITY_OPTIONS: SelectOption[] = [
  { label: 'Provider default', value: 'auto' },
  { label: 'Standard', value: 'standard' },
  { label: 'HD (High Definition)', value: 'hd' },
];

const IMAGE_COUNT_OPTIONS: SelectOption[] = [
  { label: '1 image', value: '1' },
  { label: '2 images', value: '2' },
  { label: '3 images', value: '3' },
  { label: '4 images', value: '4' },
];

export interface ImageLabProps {
  gatewayKey: string;
  visionModelCount: number;
  resolveModel: (mode: 'generate' | 'analyze') => string;
}

export function ImageLab({ gatewayKey, visionModelCount, resolveModel }: ImageLabProps) {
  const [imageMode, setImageMode] = useState<'generate' | 'analyze'>('generate');
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageSize, setImageSize] = useState('1024x1024');
  const [imageQuality, setImageQuality] = useState('auto');
  const [imageCount, setImageCount] = useState(1);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<RenderableImage[]>([]);
  const [imageLatencyMs, setImageLatencyMs] = useState<number | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const [analysisPrompt, setAnalysisPrompt] = useState(
    'Describe this image in detail. Mention any text, objects, and notable visual details.'
  );
  const [analysisImage, setAnalysisImage] = useState<{
    imageUrl: string;
    name: string;
    type: string;
    size: number;
  } | null>(null);
  const [analysisOutput, setAnalysisOutput] = useState('');
  const [analysisLatencyMs, setAnalysisLatencyMs] = useState<number | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateImage = async () => {
    const promptValue = imagePrompt.trim();
    if (!promptValue) {
      toast.error('Describe the image you want to generate.');
      return;
    }

    const modelToUse = resolveModel('generate') || 'dall-e-3';
    const keyToUse = gatewayKey || 'sk-gw-test-key';

    setIsGeneratingImage(true);
    setImageError(null);
    setImageLatencyMs(null);
    setGeneratedImages([]);

    try {
      const result = await api.generateImage(keyToUse, {
        model: modelToUse,
        prompt: promptValue,
        n: imageCount,
        size: imageSize,
        ...(imageQuality !== 'auto' ? { quality: imageQuality } : {}),
      });

      const images = extractGeneratedImages(result);
      if (images.length === 0) {
        throw new Error('The provider returned no image data.');
      }

      setGeneratedImages(images);
      setImageLatencyMs(result.latencyMs);
      toast.success(
        `Generated ${images.length} image${images.length === 1 ? '' : 's'} in ${result.latencyMs}ms`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Image generation failed';
      setImageError(message);
      toast.error(message);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleImageFile = async (file: File | null | undefined) => {
    if (!file) return;

    if (!isSupportedImageFile(file)) {
      toast.error('Choose an image file (PNG, JPEG, WebP, or GIF).');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('That image is larger than 10 MB. Try a smaller file.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAnalysisImage({
        imageUrl: dataUrl,
        name: file.name,
        type: file.type || 'image/png',
        size: file.size,
      });
      setAnalysisOutput('');
      setAnalysisError(null);
      setAnalysisLatencyMs(null);
    } catch {
      toast.error('Could not read that image file.');
    }
  };

  const handleAnalyzeImage = async () => {
    if (!analysisImage) {
      toast.error('Upload an image to analyze.');
      return;
    }

    if (!analysisPrompt.trim()) {
      toast.error('Add a question or instruction for the vision model.');
      return;
    }

    const modelToUse = resolveModel('analyze');
    if (!modelToUse) {
      toast.error('Select a vision-capable model or enter a custom slug.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisLatencyMs(null);
    setAnalysisOutput('');

    try {
      const result = await api.analyzeImage(gatewayKey || 'sk-gw-test-key', {
        model: modelToUse,
        prompt: analysisPrompt.trim(),
        imageUrl: analysisImage.imageUrl,
      });

      if (!result.content) {
        throw new Error('The model returned an empty response.');
      }

      setAnalysisOutput(result.content);
      setAnalysisLatencyMs(result.latencyMs);
      toast.success(`Analysis complete in ${result.latencyMs}ms`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Image analysis failed';
      setAnalysisError(message);
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyAnalysis = () => {
    if (!analysisOutput) return;
    void navigator.clipboard.writeText(analysisOutput);
    toast.success('Analysis copied to clipboard!');
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="size-4 text-primary" />
              Image Generation &amp; Vision
              <Badge variant="secondary" className="text-xs font-normal">
                New
              </Badge>
            </CardTitle>
            <CardDescription>
              Generate images through <InlineCode>/v1/images/generations</InlineCode> or analyze
              an upload with a vision model through{' '}
              <InlineCode>/v1/chat/completions</InlineCode>.
            </CardDescription>
          </div>

          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={imageMode}
            onValueChange={(val) => {
              if (val) setImageMode(val as 'generate' | 'analyze');
            }}
            aria-label="Image mode"
            className="self-start sm:self-auto"
          >
            <ToggleGroupItem value="generate" className="gap-1.5 px-2.5 text-xs">
              <Wand2 className="size-3.5" />
              Generate
            </ToggleGroupItem>
            <ToggleGroupItem value="analyze" className="gap-1.5 px-2.5 text-xs">
              <ScanEye className="size-3.5" />
              Analyze
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {imageMode === 'generate' ? (
          <>
            <Field className="gap-1.5">
              <FieldLabel
                htmlFor="image-prompt"
                className="text-xs font-semibold text-muted-foreground"
              >
                Prompt
              </FieldLabel>
              <Textarea
                id="image-prompt"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Describe the image you want to create..."
                rows={4}
                className="min-h-[96px] resize-y text-sm"
              />
              <div className="flex flex-wrap gap-1.5">
                {IMAGE_PROMPT_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setImagePrompt(suggestion)}
                    className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </Field>

            <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field className="gap-1.5">
                <FieldLabel
                  htmlFor="image-size"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Size
                </FieldLabel>
                <ReactSelect
                  options={IMAGE_SIZE_OPTIONS}
                  value={imageSize}
                  onValueChange={(val) => setImageSize(val || '1024x1024')}
                  placeholder="1024x1024"
                  isSearchable={false}
                />
              </Field>

              <Field className="gap-1.5">
                <FieldLabel
                  htmlFor="image-quality"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Quality
                </FieldLabel>
                <ReactSelect
                  options={IMAGE_QUALITY_OPTIONS}
                  value={imageQuality}
                  onValueChange={(val) => setImageQuality(val || 'auto')}
                  placeholder="Provider default"
                  isSearchable={false}
                />
              </Field>

              <Field className="gap-1.5">
                <FieldLabel
                  htmlFor="image-count"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Images
                </FieldLabel>
                <ReactSelect
                  options={IMAGE_COUNT_OPTIONS}
                  value={String(imageCount)}
                  onValueChange={(val) => setImageCount(Number(val) || 1)}
                  placeholder="1 image"
                  isSearchable={false}
                />
              </Field>
            </FieldGroup>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => void handleGenerateImage()}
                disabled={isGeneratingImage || !imagePrompt.trim()}
              >
                {isGeneratingImage ? (
                  <>
                    <Spinner />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="size-4" />
                    <span>Generate Image</span>
                  </>
                )}
              </Button>
              {imageLatencyMs !== null && (
                <Badge variant="secondary" className="gap-1 font-mono">
                  <Timer className="size-3" />
                  <span>{imageLatencyMs}ms</span>
                </Badge>
              )}
              {generatedImages.length > 0 && (
                <Badge variant="success" className="gap-1">
                  <Sparkles className="size-3" />
                  <span>
                    {generatedImages.length} image{generatedImages.length === 1 ? '' : 's'}
                  </span>
                </Badge>
              )}
            </div>

            {imageError && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Image generation failed</AlertTitle>
                <AlertDescription className="font-mono text-xs">{imageError}</AlertDescription>
              </Alert>
            )}

            {isGeneratingImage ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: imageCount }).map((_, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-lg border border-border bg-muted/30"
                  >
                    <Skeleton className="aspect-square w-full" />
                    <div className="p-3">
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : generatedImages.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {generatedImages.map((image, index) => (
                  <div
                    key={`${index}-${image.src.slice(0, 24)}`}
                    className="group overflow-hidden rounded-lg border border-border bg-muted/30"
                  >
                    <a
                      href={image.src}
                      target="_blank"
                      rel="noreferrer"
                      title="Open full size"
                      className="block aspect-square w-full overflow-hidden bg-muted"
                    >
                      <img
                        src={image.src}
                        alt={image.revisedPrompt || `Generated image ${index + 1}`}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </a>
                    <div className="flex items-center justify-between gap-2 p-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">Image {index + 1}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {image.source === 'url' ? 'hosted URL' : image.mimeType}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0"
                          title="Analyze this image"
                          onClick={() => {
                            setAnalysisImage({
                              imageUrl: image.src,
                              name: `Generated image ${index + 1}`,
                              type: image.mimeType,
                              size: 0,
                            });
                            setAnalysisOutput('');
                            setAnalysisError(null);
                            setAnalysisLatencyMs(null);
                            setImageMode('analyze');
                          }}
                        >
                          <ScanEye className="size-3.5" />
                          <span className="sr-only">Analyze image</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="size-7 p-0"
                          title="Open full size"
                        >
                          <a href={image.src} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3.5" />
                            <span className="sr-only">Open image</span>
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="size-7 p-0"
                          title="Download image"
                        >
                          <a
                            href={image.src}
                            download={`generated-${index + 1}.${extensionForMime(image.mimeType)}`}
                          >
                            <Download className="size-3.5" />
                            <span className="sr-only">Download image</span>
                          </a>
                        </Button>
                      </div>
                    </div>
                    {image.revisedPrompt && (
                      <p className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                        {image.revisedPrompt}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty className="rounded-lg border border-dashed border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ImageIcon />
                  </EmptyMedia>
                  <EmptyTitle>No images yet</EmptyTitle>
                  <EmptyDescription>
                    Describe a scene above and generate it with a model that supports image output.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </>
        ) : (
          <>
            {visionModelCount === 0 && (
              <Alert>
                <Info className="size-4 text-primary" />
                <AlertDescription className="text-xs text-muted-foreground">
                  No enabled model is tagged <InlineCode>vision</InlineCode>. Auto-select falls
                  back to a known vision family when possible; otherwise pick a model above or
                  enter a custom slug that accepts OpenAI <InlineCode>image_url</InlineCode>{' '}
                  content parts.
                </AlertDescription>
              </Alert>
            )}

            <Field className="gap-1.5">
              <FieldLabel className="text-xs font-semibold text-muted-foreground">Image</FieldLabel>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  void handleImageFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload an image for analysis"
                onClick={() => imageInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    imageInputRef.current?.click();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDraggingImage(true);
                }}
                onDragLeave={() => setIsDraggingImage(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDraggingImage(false);
                  void handleImageFile(event.dataTransfer.files?.[0]);
                }}
                className={cn(
                  'flex cursor-pointer items-center gap-4 rounded-lg border border-dashed p-4 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  isDraggingImage
                    ? 'border-primary/70 bg-primary/5'
                    : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                )}
              >
                {analysisImage ? (
                  <>
                    <img
                      src={analysisImage.imageUrl}
                      alt={analysisImage.name}
                      className="size-20 shrink-0 rounded-md border border-border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{analysisImage.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {analysisImage.type}
                        {analysisImage.size > 0
                          ? ` · ${formatBytes(analysisImage.size)}`
                          : ' · from generated image'}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            imageInputRef.current?.click();
                          }}
                        >
                          <Upload className="size-3.5" />
                          Replace
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            setAnalysisImage(null);
                            setAnalysisOutput('');
                            setAnalysisError(null);
                            setAnalysisLatencyMs(null);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Upload className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">Drop an image here or click to browse</p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPEG, WebP, or GIF · up to 10 MB. Sent as a data URL.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Field>

            <Field className="gap-1.5">
              <FieldLabel
                htmlFor="analysis-prompt"
                className="text-xs font-semibold text-muted-foreground"
              >
                Question / Instruction
              </FieldLabel>
              <Textarea
                id="analysis-prompt"
                value={analysisPrompt}
                onChange={(e) => setAnalysisPrompt(e.target.value)}
                rows={3}
                className="min-h-[80px] resize-y text-sm"
              />
              <div className="flex flex-wrap gap-1.5">
                {ANALYSIS_PROMPT_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setAnalysisPrompt(suggestion)}
                    className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void handleAnalyzeImage()} disabled={isAnalyzing || !analysisImage}>
                {isAnalyzing ? (
                  <>
                    <Spinner />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <ScanEye className="size-4" />
                    <span>Analyze Image</span>
                  </>
                )}
              </Button>
              {analysisOutput && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyAnalysis}
                  className="gap-1.5 text-xs"
                >
                  <Copy className="size-3.5" />
                  Copy
                </Button>
              )}
            </div>

            {analysisError && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Image analysis failed</AlertTitle>
                <AlertDescription className="font-mono text-xs">{analysisError}</AlertDescription>
              </Alert>
            )}

            {isAnalyzing ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-4">
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ) : analysisOutput ? (
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Sparkles className="size-3.5 text-primary" />
                    Vision Response
                  </span>
                  {analysisLatencyMs !== null && (
                    <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
                      <Timer className="size-3" />
                      {analysisLatencyMs}ms
                    </Badge>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{analysisOutput}</p>
              </div>
            ) : (
              <Empty className="rounded-lg border border-dashed border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ScanEye />
                  </EmptyMedia>
                  <EmptyTitle>Nothing analyzed yet</EmptyTitle>
                  <EmptyDescription>
                    Upload an image, add an instruction, then run it through a vision model.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
