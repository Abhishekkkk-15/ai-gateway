import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ModelView } from '../lib/api.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Switch } from '../components/ui/Switch.js';
import { Search, Copy, Check, Tag, Cpu } from 'lucide-react';

export function ModelsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [editingAliases, setEditingAliases] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: () => api.getModels(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: Parameters<typeof api.updateModel>[1] }) =>
      api.updateModel(slug, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });

  const models = data?.models || [];
  const filteredModels = models.filter(
    (m) =>
      m.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.providerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.customAlias && m.customAlias.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedSlug(text);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleSaveAlias = (slug: string) => {
    const alias = editingAliases[slug];
    if (alias !== undefined) {
      updateMutation.mutate({
        slug,
        data: { customAlias: alias },
      });
    }
  };

  const handleToggle = (slug: string, checked: boolean) => {
    updateMutation.mutate({
      slug,
      data: { isEnabled: checked },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Models & Routable Aliases</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse discovered provider models, configure short aliases (e.g. <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">fast-chat</code>), and manage availability.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models, providers, aliases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/70 overflow-hidden shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Status</TableHead>
              <TableHead>Model Slug (Routable ID)</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Capabilities</TableHead>
              <TableHead>Context</TableHead>
              <TableHead>Custom Alias</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Loading model catalog...
                </TableCell>
              </TableRow>
            ) : filteredModels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No models found. Click &quot;Test &amp; Sync Models&quot; on the Providers page to populate.
                </TableCell>
              </TableRow>
            ) : (
              filteredModels.map((m) => {
                const currentAliasVal = editingAliases[m.slug] ?? (m.customAlias || '');
                return (
                  <TableRow key={m.slug} className={!m.isEnabled ? 'opacity-60 bg-muted/20' : ''}>
                    <TableCell>
                      <Switch
                        checked={m.isEnabled}
                        onCheckedChange={(checked) => handleToggle(m.slug, checked)}
                      />
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Cpu className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <div className="font-mono text-xs font-semibold">{m.slug}</div>
                          <div className="text-[11px] text-muted-foreground">{m.displayName}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        {m.providerId}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              cap === 'chat'
                                ? 'bg-blue-500/10 text-blue-400'
                                : cap === 'tts'
                                  ? 'bg-purple-500/10 text-purple-400'
                                  : cap === 'stt'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-secondary text-secondary-foreground'
                            }`}
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </TableCell>

                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {m.contextWindow ? `${Math.round(m.contextWindow / 1024)}k` : '—'}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center space-x-1.5 max-w-[200px]">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <Input
                          placeholder="e.g. fast-chat"
                          value={currentAliasVal}
                          onChange={(e) => setEditingAliases({ ...editingAliases, [m.slug]: e.target.value })}
                          onBlur={() => handleSaveAlias(m.slug)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveAlias(m.slug);
                          }}
                          className="h-7 text-xs font-mono py-0 px-2"
                        />
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(m.customAlias || m.slug)}
                        title="Copy model identifier"
                        className="h-8 px-2"
                      >
                        {copiedSlug === (m.customAlias || m.slug) ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
