import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type ModelView } from '../lib/api.js';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table.js';
import { Input } from '../components/ui/input.js';
import { Button } from '../components/ui/button.js';
import { Badge } from '../components/ui/badge.js';
import { Switch } from '../components/ui/switch.js';
import { Skeleton } from '../components/ui/skeleton.js';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu.js';
import { Search, Tag, Copy, Check, MoreHorizontal, Layers, CheckCircle2 } from 'lucide-react';

export function ModelsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingAliases, setEditingAliases] = useState<Record<string, string>>({});
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: () => api.getModels(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ slug, isEnabled }: { slug: string; isEnabled: boolean }) =>
      api.updateModel(slug, { isEnabled }),
    onSuccess: (_, vars) => {
      toast.success(`Model ${vars.slug} ${vars.isEnabled ? 'enabled' : 'disabled'}`);
      void queryClient.invalidateQueries({ queryKey: ['models'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle model');
    },
  });

  const aliasMutation = useMutation({
    mutationFn: ({ slug, customAlias }: { slug: string; customAlias: string | null }) =>
      api.updateModel(slug, { customAlias }),
    onSuccess: (_, vars) => {
      toast.success(
        vars.customAlias
          ? `Alias '${vars.customAlias}' mapped to ${vars.slug}`
          : `Alias removed for ${vars.slug}`
      );
      void queryClient.invalidateQueries({ queryKey: ['models'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update alias');
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSlug(text);
    toast.success(`Copied '${text}' to clipboard!`);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleSaveAlias = (slug: string) => {
    const val = editingAliases[slug];
    if (val === undefined) return;
    aliasMutation.mutate({ slug, customAlias: val.trim() || null });
  };

  const models = data?.models || [];
  const filtered = models.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.slug.toLowerCase().includes(q) ||
      m.providerId.toLowerCase().includes(q) ||
      (m.customAlias && m.customAlias.toLowerCase().includes(q))
    );
  });

  const activeCount = models.filter((m) => m.isEnabled).length;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Models Catalog</h1>
            <Badge variant="outline" className="text-xs font-mono">
              {activeCount} / {models.length} Enabled
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Zero-overhead in-memory routable models. Set custom aliases to decouple frontend code from upstream provider slugs.
          </p>
        </div>

        <div className="w-full sm:w-72 relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search models, providers, aliases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card/60 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">Status</TableHead>
              <TableHead>Model Slug (Upstream ID)</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Capabilities</TableHead>
              <TableHead>Context</TableHead>
              <TableHead>Routable Alias</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="text-center">
                    <Skeleton className="size-4 rounded-full mx-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-7 w-32" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="size-8 rounded ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                    <Layers className="size-6 text-muted-foreground/40" />
                    <span className="text-sm font-medium text-foreground">No models found</span>
                    <span className="text-xs text-muted-foreground">
                      {search
                        ? 'Try adjusting your search filter.'
                        : 'Configure a provider and trigger "Sync Models" to populate this catalog.'}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => {
                const currentAliasVal = editingAliases[m.slug] ?? m.customAlias ?? '';
                return (
                  <TableRow key={m.slug} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="text-center">
                      <Switch
                        checked={m.isEnabled}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ slug: m.slug, isEnabled: checked })
                        }
                      />
                    </TableCell>

                    <TableCell className="font-mono text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span>{m.slug}</span>
                        {m.customAlias && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                            alias: {m.customAlias}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px] uppercase">
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
                      <div className="flex items-center gap-1.5 max-w-[200px]">
                        <Tag className="size-3.5 text-muted-foreground shrink-0" />
                        <Input
                          placeholder="e.g. fast-chat"
                          value={currentAliasVal}
                          onChange={(e) =>
                            setEditingAliases({ ...editingAliases, [m.slug]: e.target.value })
                          }
                          onBlur={() => handleSaveAlias(m.slug)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveAlias(m.slug);
                          }}
                          className="h-7 text-xs font-mono py-0 px-2"
                        />
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="size-8 p-0">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel className="text-xs">Model Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleCopy(m.customAlias || m.slug)}>
                            <Copy className="size-3.5 mr-2" />
                            <span>Copy Model Identifier</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              toggleMutation.mutate({
                                slug: m.slug,
                                isEnabled: !m.isEnabled,
                              })
                            }
                          >
                            <CheckCircle2 className="size-3.5 mr-2" />
                            <span>{m.isEnabled ? 'Disable Model' : 'Enable Model'}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
