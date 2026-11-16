import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ProviderView } from '../lib/api.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';
import { Switch } from '../components/ui/Switch.js';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/Dialog.js';
import { Eye, EyeOff, RefreshCw, Plus, CheckCircle, ShieldCheck, Sparkles, ExternalLink } from 'lucide-react';

export function ProvidersPage() {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<Record<string, string>>({});
  const [editingUrl, setEditingUrl] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Add Custom Provider Dialog State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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
      setFeedback(`Saved settings for ${vars.id}`);
      setTimeout(() => setFeedback(null), 3000);
      void queryClient.invalidateQueries({ queryKey: ['providers'] });
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
      setFeedback(res.message);
      void queryClient.invalidateQueries({ queryKey: ['models'] });
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncingId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleCreateCustomProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = customId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!id || !customName.trim() || !customBaseUrl.trim()) return;

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
      setFeedback(`Custom provider '${customName}' registered!`);
      void queryClient.invalidateQueries({ queryKey: ['providers'] });
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Failed to register provider');
    }
  };

  const providers = data?.providers || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Providers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure upstream AI credentials, customized endpoints, and synchronize live model catalogs.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add Custom OpenAI Provider</span>
        </Button>
      </div>

      {feedback && (
        <div className="flex items-center space-x-2 text-sm bg-primary/10 border border-primary/30 text-primary p-3 rounded-lg">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading configured providers...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {providers.map((p) => {
            const isConfigured = p.isConfigured;
            const keyVal = editingKey[p.id] ?? '';
            const isShowingKey = showKey[p.id] ?? false;

            return (
              <Card key={p.id} className="border-border/80 bg-card/60 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-lg">{p.name}</CardTitle>
                      {p.isBuiltIn ? (
                        <Badge variant="secondary" className="text-[10px]">Built-in</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Custom OpenAI</Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs font-mono mt-1">id: {p.id}</CardDescription>
                  </div>
                  <div className="flex items-center space-x-3">
                    {!isConfigured ? (
                      <Badge variant="secondary">Not Configured</Badge>
                    ) : p.isEnabled ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="destructive">Disabled</Badge>
                    )}
                    <div className="flex items-center space-x-1.5">
                      <Switch
                        checked={p.isEnabled}
                        onCheckedChange={(checked) => handleToggle(p, checked)}
                        disabled={!isConfigured}
                      />
                      <span className="text-[11px] text-muted-foreground select-none">
                        {p.isEnabled ? 'On' : 'Off'}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                      <span>API Key</span>
                      <span className="text-[10px] text-muted-foreground flex items-center">
                        <ShieldCheck className="h-3 w-3 mr-1 text-emerald-400" /> Encrypted at rest
                      </span>
                    </label>
                    <div className="flex space-x-2">
                      <Input
                        type={isShowingKey ? 'text' : 'password'}
                        placeholder={isConfigured ? '••••••••••••••••••••••••' : 'Enter upstream API key...'}
                        value={keyVal}
                        onChange={(e) => setEditingKey({ ...editingKey, [p.id]: e.target.value })}
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowKey({ ...showKey, [p.id]: !isShowingKey })}
                        type="button"
                      >
                        {isShowingKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Endpoint Base URL</label>
                    <Input
                      type="text"
                      value={editingUrl[p.id] ?? p.baseUrl}
                      onChange={(e) => setEditingUrl({ ...editingUrl, [p.id]: e.target.value })}
                      placeholder={p.defaultBaseUrl}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {p.supportedCapabilities.map((cap) => (
                      <span key={cap} className="px-2 py-0.5 rounded text-[11px] bg-secondary text-secondary-foreground font-mono">
                        {cap}
                      </span>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="flex justify-between border-t border-border/50 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(p)}
                    disabled={!isConfigured || syncingId === p.id}
                    className="flex items-center space-x-1.5 text-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                    <span>Test & Sync Models</span>
                  </Button>
                  <Button size="sm" onClick={() => handleSave(p)} className="text-xs">
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Custom Provider Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <form onSubmit={handleCreateCustomProvider}>
          <DialogHeader>
            <DialogTitle>Add Custom OpenAI-Compatible Provider</DialogTitle>
            <DialogDescription>
              Connect any OpenAI-compatible provider (DeepSeek, Together AI, Mistral, Ollama, Perplexity, vLLM) instantly without code.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Provider Name</label>
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

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Provider Slug ID (alphanumeric)</label>
              <Input
                placeholder="e.g. deepseek"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                required
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Base URL</label>
              <Input
                placeholder="e.g. https://api.deepseek.com/v1"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                required
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">API Key (optional for local models)</label>
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
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Register Provider
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
