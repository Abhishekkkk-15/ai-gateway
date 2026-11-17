import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type ProviderView } from '../lib/api.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../components/ui/card.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Badge } from '../components/ui/badge.js';
import { Switch } from '../components/ui/switch.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { Spinner } from '../components/ui/spinner.js';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.js';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '../components/ui/empty.js';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../components/ui/input-group.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog.js';
import { Eye, EyeOff, RefreshCw, Plus, ShieldCheck, Server } from 'lucide-react';

export function ProvidersPage() {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<Record<string, string>>({});
  const [editingUrl, setEditingUrl] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customId, setCustomId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('https://api.deepseek.com/v1');
  const [customApiKey, setCustomApiKey] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.getProviders(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateProvider>[1] }) =>
      api.updateProvider(id, data),
    onSuccess: (_, vars) => {
      toast.success(`Settings saved for ${vars.id}`);
      void queryClient.invalidateQueries({ queryKey: ['providers'] });
      void queryClient.invalidateQueries({ queryKey: ['models'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update provider');
    },
  });

  const handleSave = (provider: ProviderView) => {
    const key = editingKey[provider.id];
    const url = editingUrl[provider.id];

    updateMutation.mutate({
      id: provider.id,
      data: {
        name: provider.name,
        adapterType: provider.adapterType || 'openai-compatible',
        apiKey: key !== undefined ? key : undefined,
        baseUrl: url !== undefined ? url : provider.baseUrl,
        isEnabled: true,
      },
    });
  };

  const handleToggle = (provider: ProviderView, checked: boolean) => {
    updateMutation.mutate({
      id: provider.id,
      data: { isEnabled: checked },
    });
  };

  const handleSync = async (provider: ProviderView) => {
    setSyncingId(provider.id);
    try {
      const res = await api.syncProviderModels(provider.id);
      toast.success(res.message);
      void queryClient.invalidateQueries({ queryKey: ['models'] });
      void queryClient.invalidateQueries({ queryKey: ['providers'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handleCreateCustomProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = customId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!id || !customName.trim() || !customBaseUrl.trim() || isCreatingCustom) return;

    setIsCreatingCustom(true);
    try {
      await api.updateProvider(id, {
        name: customName.trim(),
        adapterType: 'openai-compatible',
        baseUrl: customBaseUrl.trim(),
        apiKey: customApiKey.trim(),
        isEnabled: true,
      });

      setIsAddModalOpen(false);
      setCustomId('');
      setCustomName('');
      setCustomApiKey('');
      toast.success(`Custom provider '${customName}' registered!`);
      void queryClient.invalidateQueries({ queryKey: ['providers'] });
      void queryClient.invalidateQueries({ queryKey: ['models'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create provider');
    } finally {
      setIsCreatingCustom(false);
    }
  };

  const providers = data?.providers || [];

  return (
    <div className="page-shell">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">AI Model Providers</h1>
          <p className="page-description">
            Manage upstream providers, credentials, and synchronized model catalogs.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="self-start sm:self-auto">
          <Plus />
          Add Custom Provider
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-9 w-full mt-2" />
              <Skeleton className="h-9 w-full" />
            </Card>
          ))}
        </div>
      ) : providers.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Server />
            </EmptyMedia>
            <EmptyTitle>No providers configured</EmptyTitle>
            <EmptyDescription>
              Add a custom OpenAI-compatible provider to start routing requests.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus />
              Add Custom Provider
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((p) => {
            const hasKey = p.isConfigured;
            const currentKeyVal = editingKey[p.id] ?? '';
            const currentUrlVal = editingUrl[p.id] ?? p.baseUrl;
            const isKeyVisible = showKey[p.id] || false;
            const isSyncing = syncingId === p.id;
            const isUpdating =
              updateMutation.isPending && updateMutation.variables?.id === p.id;

            return (
              <Card
                key={p.id}
                className="border-border flex flex-col justify-between hover:border-border transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{p.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.isEnabled ? 'success' : 'secondary'}>
                        {p.isEnabled ? 'Active' : 'Disabled'}
                      </Badge>
                      {isUpdating && updateMutation.variables?.data.isEnabled !== undefined ? (
                        <Spinner className="text-primary" />
                      ) : (
                        <Switch
                          checked={p.isEnabled}
                          disabled={isUpdating}
                          onCheckedChange={(checked) => handleToggle(p, checked)}
                        />
                      )}
                    </div>
                  </div>
                  <CardDescription className="text-xs font-mono flex items-center gap-2 flex-wrap">
                    <span>{p.id}</span>
                    {p.adapterType === 'openai-compatible' && (
                      <Badge variant="secondary" className="font-mono">
                        openai-compatible
                      </Badge>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <FieldGroup className="gap-4">
                    <Field>
                      <FieldLabel className="text-xs text-muted-foreground">Base URL</FieldLabel>
                      <Input
                        value={currentUrlVal}
                        onChange={(e) =>
                          setEditingUrl({ ...editingUrl, [p.id]: e.target.value })
                        }
                        placeholder="https://..."
                        className="font-mono text-xs"
                      />
                    </Field>

                    <Field>
                      <div className="flex items-center justify-between">
                        <FieldLabel className="text-xs text-muted-foreground">API Key</FieldLabel>
                        {hasKey && (
                          <span className="text-xs text-chart-2 flex items-center gap-1">
                            <ShieldCheck className="size-3" />
                            <span>Encrypted</span>
                          </span>
                        )}
                      </div>
                      <InputGroup>
                        <InputGroupInput
                          type={isKeyVisible ? 'text' : 'password'}
                          value={currentKeyVal}
                          onChange={(e) =>
                            setEditingKey({ ...editingKey, [p.id]: e.target.value })
                          }
                          placeholder={hasKey ? '••••••••••••••••••••••••' : 'Enter API Key...'}
                          className="font-mono text-xs"
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            size="icon-xs"
                            onClick={() => setShowKey({ ...showKey, [p.id]: !isKeyVisible })}
                            aria-label={isKeyVisible ? 'Hide API key' : 'Show API key'}
                          >
                            {isKeyVisible ? <EyeOff /> : <Eye />}
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                  </FieldGroup>
                </CardContent>

                <CardFooter className="pt-2 flex items-center justify-between border-t border-border gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(p)}
                    disabled={isSyncing || !p.isEnabled}
                    className="text-xs"
                  >
                    {isSyncing ? <Spinner /> : <RefreshCw />}
                    {isSyncing ? 'Syncing...' : 'Sync Models'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSave(p)}
                    disabled={isUpdating}
                    className="text-xs"
                  >
                    {isUpdating ? (
                      <>
                        <Spinner />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateCustomProvider} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Add Custom OpenAI-Compatible Provider</DialogTitle>
              <DialogDescription>
                Connect any OpenAI-compatible provider (DeepSeek, Together AI, Mistral, Ollama, Perplexity, vLLM) instantly without code.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="gap-4 py-2">
              <Field>
                <FieldLabel className="text-xs text-muted-foreground">Provider Name</FieldLabel>
                <Input
                  placeholder="e.g. DeepSeek AI"
                  value={customName}
                  onChange={(e) => {
                    setCustomName(e.target.value);
                    if (!customId) {
                      setCustomId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                    }
                  }}
                  required
                />
              </Field>

              <Field>
                <FieldLabel className="text-xs text-muted-foreground">Provider Slug ID (alphanumeric)</FieldLabel>
                <Input
                  placeholder="e.g. deepseek"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  required
                  className="font-mono text-xs"
                />
              </Field>

              <Field>
                <FieldLabel className="text-xs text-muted-foreground">Base URL</FieldLabel>
                <Input
                  placeholder="e.g. https://api.deepseek.com/v1"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  required
                  className="font-mono text-xs"
                />
              </Field>

              <Field>
                <FieldLabel className="text-xs text-muted-foreground">API Key (optional for local models)</FieldLabel>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="font-mono text-xs"
                />
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                disabled={isCreatingCustom}
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingCustom}>
                {isCreatingCustom ? (
                  <>
                    <Spinner />
                    Registering...
                  </>
                ) : (
                  'Register Provider'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
