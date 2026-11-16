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
import { Label } from '../components/ui/label.js';
import { Badge } from '../components/ui/badge.js';
import { Switch } from '../components/ui/switch.js';
import { Skeleton } from '../components/ui/skeleton.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog.js';
import { Eye, EyeOff, RefreshCw, Plus, CheckCircle, ShieldCheck, Loader2 } from 'lucide-react';

export function ProvidersPage() {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<Record<string, string>>({});
  const [editingUrl, setEditingUrl] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Add Custom Provider Dialog State
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
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Model Providers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage upstream providers, credentials, and synchronized model catalogs.
          </p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
        >
          <Plus className="size-4" />
          <span>Add Custom Provider</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/80 p-6 flex flex-col gap-4">
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((p) => {
            const hasKey = p.isConfigured;
            const currentKeyVal = editingKey[p.id] ?? '';
            const currentUrlVal = editingUrl[p.id] ?? p.baseUrl;
            const isKeyVisible = showKey[p.id] || false;
            const isSyncing = syncingId === p.id;

            return (
              <Card
                key={p.id}
                className="border-border/80 flex flex-col justify-between shadow-sm hover:border-border transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{p.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={p.isEnabled ? 'outline' : 'secondary'}
                        className={`text-[10px] font-mono ${
                          p.isEnabled
                            ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                            : ''
                        }`}
                      >
                        {p.isEnabled ? 'Active' : 'Disabled'}
                      </Badge>
                      {updateMutation.isPending &&
                      updateMutation.variables?.id === p.id &&
                      updateMutation.variables?.data.isEnabled !== undefined ? (
                        <Loader2 className="size-4 animate-spin text-primary" />
                      ) : (
                        <Switch
                          checked={p.isEnabled}
                          disabled={updateMutation.isPending && updateMutation.variables?.id === p.id}
                          onCheckedChange={(checked) => handleToggle(p, checked)}
                        />
                      )}
                    </div>
                  </div>
                  <CardDescription className="text-xs font-mono">{p.id}</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4 flex-1">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Base URL</Label>
                    <Input
                      value={currentUrlVal}
                      onChange={(e) =>
                        setEditingUrl({ ...editingUrl, [p.id]: e.target.value })
                      }
                      placeholder="https://..."
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-muted-foreground">API Key</Label>
                      {hasKey && (
                        <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-mono">
                          <ShieldCheck className="size-3" />
                          <span>Encrypted</span>
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type={isKeyVisible ? 'text' : 'password'}
                        value={currentKeyVal}
                        onChange={(e) =>
                          setEditingKey({ ...editingKey, [p.id]: e.target.value })
                        }
                        placeholder={hasKey ? '••••••••••••••••••••••••' : 'Enter API Key...'}
                        className="font-mono text-xs pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey({ ...showKey, [p.id]: !isKeyVisible })}
                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                      >
                        {isKeyVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 flex items-center justify-between border-t border-border/40 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(p)}
                    disabled={isSyncing || !p.isEnabled}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className={`size-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Models'}</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSave(p)}
                    disabled={updateMutation.isPending && updateMutation.variables?.id === p.id}
                    className="text-xs"
                  >
                    {updateMutation.isPending && updateMutation.variables?.id === p.id ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Custom Provider Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateCustomProvider} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Add Custom OpenAI-Compatible Provider</DialogTitle>
              <DialogDescription>
                Connect any OpenAI-compatible provider (DeepSeek, Together AI, Mistral, Ollama, Perplexity, vLLM) instantly without code.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Provider Name</Label>
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
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Provider Slug ID (alphanumeric)</Label>
                <Input
                  placeholder="e.g. deepseek"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  required
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Base URL</Label>
                <Input
                  placeholder="e.g. https://api.deepseek.com/v1"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  required
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">API Key (optional for local models)</Label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

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
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <span>Register Provider</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
