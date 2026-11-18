import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Switch } from '../ui/switch.js';
import { Badge } from '../ui/badge.js';
import { Spinner } from '../ui/spinner.js';
import { ReactSelect, type SelectOption } from '../ui/react-select.js';
import { api, type ModelView } from '../../lib/api.js';
import { Layers, Plus, Sparkles, Cpu, Hash, Tag, Compass, AlertCircle } from 'lucide-react';
import type { SingleValue, MultiValue } from 'react-select';

export interface AddModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModelAdded?: (model: ModelView) => void;
  defaultProviderId?: string;
}

const CAPABILITY_OPTIONS: SelectOption[] = [
  { label: 'Chat (Completions)', value: 'chat' },
  { label: 'Vision (Multimodal)', value: 'vision' },
  { label: 'Embeddings (Vectors)', value: 'embeddings' },
  { label: 'Tools (Function Calling)', value: 'tools' },
  { label: 'STT (Speech-to-Text)', value: 'stt' },
  { label: 'TTS (Text-to-Speech)', value: 'tts' },
];

const TOKEN_PRESETS = [
  { label: '8K', value: 8192 },
  { label: '32K', value: 32768 },
  { label: '128K', value: 128000 },
  { label: '200K', value: 200000 },
  { label: '1M', value: 1048576 },
  { label: '2M', value: 2097152 },
];

export function AddModelDialog({
  open,
  onOpenChange,
  onModelAdded,
  defaultProviderId,
}: AddModelDialogProps) {
  const queryClient = useQueryClient();

  // Form State
  const [providerId, setProviderId] = useState(defaultProviderId || '');
  const [modelId, setModelId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [capabilities, setCapabilities] = useState<string[]>(['chat']);
  const [contextWindow, setContextWindow] = useState<number | ''>('');
  const [customAlias, setCustomAlias] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);

  // Sync default provider when passed or dialog opens
  useEffect(() => {
    if (defaultProviderId) {
      setProviderId(defaultProviderId);
    }
  }, [defaultProviderId]);

  // Fetch only user-configured providers from backend
  const { data: providersData, isLoading: isLoadingProviders } = useQuery({
    queryKey: ['providers', 'configured'],
    queryFn: () => api.getProviders({ configuredOnly: true }),
    enabled: open,
  });

  // Filter to providers actually configured by the user
  const configuredProviders = useMemo(() => {
    return (providersData?.providers || []).filter(
      (p) => p.isConfigured !== false && (p.isConfigured || p.isEnabled)
    );
  }, [providersData]);

  // Provider Options for ReactSelect
  const providerOptions: SelectOption[] = useMemo(() => {
    return configuredProviders.map((p) => ({
      label: p.name ? `${p.name} (${p.id})` : p.id,
      value: p.id,
      description: p.adapterType,
    }));
  }, [configuredProviders]);

  // Capabilities Options (Selected values mapped to SelectOption[])
  const selectedCapabilitiesOptions = useMemo(() => {
    return CAPABILITY_OPTIONS.filter((opt) => capabilities.includes(opt.value));
  }, [capabilities]);

  const handleCapabilitiesChange = (selected: MultiValue<SelectOption>) => {
    setCapabilities(selected.map((item) => item.value));
  };

  const resetForm = () => {
    setProviderId(defaultProviderId || '');
    setModelId('');
    setDisplayName('');
    setCapabilities(['chat']);
    setContextWindow('');
    setCustomAlias('');
    setIsEnabled(true);
  };

  const createModelMutation = useMutation({
    mutationFn: (payload: {
      providerId: string;
      modelId: string;
      displayName?: string;
      capabilities?: string[];
      contextWindow?: number | null;
      customAlias?: string | null;
      isEnabled?: boolean;
    }) => api.createModel(payload),
    onSuccess: (data) => {
      toast.success(data.message || 'Model added to catalog successfully!');
      void queryClient.invalidateQueries({ queryKey: ['models'] });
      if (onModelAdded && data.model) {
        onModelAdded(data.model);
      }
      resetForm();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to register model');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!providerId.trim()) {
      toast.error('Please select an upstream provider.');
      return;
    }

    if (!modelId.trim()) {
      toast.error('Please enter an upstream model ID.');
      return;
    }

    if (capabilities.length === 0) {
      toast.error('Please select at least one capability.');
      return;
    }

    createModelMutation.mutate({
      providerId: providerId.trim(),
      modelId: modelId.trim(),
      displayName: displayName.trim() || undefined,
      capabilities,
      contextWindow: typeof contextWindow === 'number' ? contextWindow : null,
      customAlias: customAlias.trim() || null,
      isEnabled,
    });
  };

  // Preview slug
  const previewSlug = providerId && modelId ? `${providerId}/${modelId}` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar"
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (
            target?.closest?.('.react-select__menu') ||
            target?.closest?.('[class*="react-select"]') ||
            target?.closest?.('[class*="-menu"]')
          ) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Layers className="size-5 text-primary" />
            Add Model to Catalog
          </DialogTitle>
          <DialogDescription className="text-xs">
            Manually register an upstream model or custom deployment not automatically discovered from the provider.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          {/* Provider Selection */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Cpu className="size-3.5 text-muted-foreground" />
                Upstream Provider <span className="text-destructive">*</span>
              </span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Fetched from configured providers
              </span>
            </Label>
            <ReactSelect
              isLoading={isLoadingProviders}
              options={providerOptions}
              value={providerOptions.find((p) => p.value === providerId) || (providerId ? { label: providerId, value: providerId } : null)}
              onChange={(selected: SingleValue<SelectOption>) => setProviderId(selected?.value || '')}
              placeholder={isLoadingProviders ? 'Loading configured providers...' : 'Select a configured provider...'}
              isClearable
            />
            {configuredProviders.length === 0 && !isLoadingProviders && (
              <div className="flex items-center gap-2 p-2.5 rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-500 text-xs">
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  No configured providers found. Please configure your provider API key on the AI Providers page first.
                </span>
              </div>
            )}
          </div>

          {/* Model Upstream ID & Display Name (Text Inputs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Upstream ID */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upstream-model-id" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Hash className="size-3.5 text-muted-foreground" />
                Upstream Model ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="upstream-model-id"
                type="text"
                placeholder="e.g. llama-3.3-70b-versatile, gpt-4o"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="h-9 font-mono text-xs"
                required
              />
              <p className="text-[10px] text-muted-foreground font-mono">
                Exact upstream identifier used by the provider
              </p>
            </div>

            {/* Display Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model-display-name" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Tag className="size-3.5 text-muted-foreground" />
                Model Display Name
              </Label>
              <Input
                id="model-display-name"
                type="text"
                placeholder="e.g. Llama 3.3 70B Versatile"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-9 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Human-friendly label for dashboard and logs
              </p>
            </div>
          </div>

          {/* Capabilities Multi-Select */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-muted-foreground" />
                Capabilities <span className="text-destructive">*</span>
              </span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Multi-select supported features
              </span>
            </Label>
            <ReactSelect
              isMulti
              options={CAPABILITY_OPTIONS}
              value={selectedCapabilitiesOptions}
              onChange={handleCapabilitiesChange}
              placeholder="Select capabilities (chat, vision, tools, etc.)..."
              closeMenuOnSelect={false}
            />
          </div>

          {/* Context Window & Custom Alias */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Context Window */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model-context-window" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Compass className="size-3.5 text-muted-foreground" />
                Context Window (tokens)
              </Label>
              <Input
                id="model-context-window"
                type="number"
                min={1}
                placeholder="e.g. 128000"
                value={contextWindow}
                onChange={(e) => {
                  const val = e.target.value;
                  setContextWindow(val === '' ? '' : Math.max(1, parseInt(val, 10)));
                }}
                className="h-9 font-mono text-xs"
              />
              {/* Quick Click Token Chips */}
              <div className="flex flex-wrap gap-1 mt-0.5">
                {TOKEN_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setContextWindow(preset.value)}
                    className="rounded border border-border/70 bg-muted/30 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Routable Alias */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model-custom-alias" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Tag className="size-3.5 text-muted-foreground" />
                Custom Routable Alias (Optional)
              </Label>
              <Input
                id="model-custom-alias"
                type="text"
                placeholder="e.g. fast-chat, primary-llm"
                value={customAlias}
                onChange={(e) => setCustomAlias(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                className="h-9 font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Short alias that clients can call directly in API requests
              </p>
            </div>
          </div>

          {/* Live Slug Preview */}
          {previewSlug && (
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Routable Target Preview
                </span>
                <span className="text-[11px] font-mono text-primary font-semibold">
                  POST /v1/chat/completions
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs bg-background">
                  {previewSlug}
                </Badge>
                {customAlias && (
                  <>
                    <span className="text-xs text-muted-foreground">&larr;</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {customAlias}
                    </Badge>
                  </>
                )}
                <div className="flex gap-1 ml-auto">
                  {capabilities.map((c) => (
                    <Badge key={c} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Enable Model Switch */}
          <div className="flex items-center justify-between rounded-lg border border-border/70 p-3 bg-card/60">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-foreground">Enable Model Immediately</span>
              <span className="text-[11px] text-muted-foreground">
                When enabled, the model is cached in-memory and can immediately serve gateway traffic.
              </span>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <DialogFooter className="mt-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={createModelMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createModelMutation.isPending || !providerId.trim() || !modelId.trim() || capabilities.length === 0}
              className="gap-1.5"
            >
              {createModelMutation.isPending ? (
                <>
                  <Spinner />
                  <span>Registering Model...</span>
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  <span>Register Model</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
