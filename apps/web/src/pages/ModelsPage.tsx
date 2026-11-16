import React, { useState, useMemo } from 'react';
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from '../components/ui/select.js';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu.js';
import {
  Search,
  Tag,
  Copy,
  Check,
  MoreHorizontal,
  Layers,
  CheckCircle2,
  Filter,
  RotateCcw,
  Loader2,
  X,
  SlidersHorizontal,
} from 'lucide-react';

export function ModelsPage() {
  const queryClient = useQueryClient();

  // Search and Filter States
  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedCapability, setSelectedCapability] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [sortBy, setSortBy] = useState<'slug' | 'context' | 'provider'>('slug');

  // Inline editing state
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

  // Dynamic filter options derived from live catalog
  const availableProviders = useMemo(() => {
    const providers = new Set(models.map((m) => m.providerId));
    return Array.from(providers).sort();
  }, [models]);

  const availableCapabilities = useMemo(() => {
    const caps = new Set(models.flatMap((m) => m.capabilities || []));
    return Array.from(caps).sort();
  }, [models]);

  // Filter and sort execution
  const filteredModels = useMemo(() => {
    return models
      .filter((m) => {
        // Search query filter
        const q = search.trim().toLowerCase();
        const matchesSearch =
          q === '' ||
          m.slug.toLowerCase().includes(q) ||
          m.providerId.toLowerCase().includes(q) ||
          (m.customAlias && m.customAlias.toLowerCase().includes(q));

        // Provider filter
        const matchesProvider =
          selectedProvider === 'all' || m.providerId === selectedProvider;

        // Capability filter
        const matchesCapability =
          selectedCapability === 'all' ||
          (m.capabilities && m.capabilities.includes(selectedCapability));

        // Status filter
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'enabled' && m.isEnabled) ||
          (statusFilter === 'disabled' && !m.isEnabled);

        return matchesSearch && matchesProvider && matchesCapability && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'slug') return a.slug.localeCompare(b.slug);
        if (sortBy === 'provider') return a.providerId.localeCompare(b.providerId);
        if (sortBy === 'context') return (b.contextWindow || 0) - (a.contextWindow || 0);
        return 0;
      });
  }, [models, search, selectedProvider, selectedCapability, statusFilter, sortBy]);

  const hasActiveFilters =
    search !== '' ||
    selectedProvider !== 'all' ||
    selectedCapability !== 'all' ||
    statusFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setSelectedProvider('all');
    setSelectedCapability('all');
    setStatusFilter('all');
    setSortBy('slug');
  };

  const activeCount = models.filter((m) => m.isEnabled).length;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Models Catalog</h1>
            <Badge variant="outline" className="text-xs font-mono border-border">
              {activeCount} / {models.length} Enabled
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Zero-overhead in-memory routable models. Set custom aliases to decouple frontend code from upstream provider slugs.
          </p>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground self-start sm:self-auto"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset Filters</span>
          </Button>
        )}
      </div>

      {/* Filter and Controls Toolbar */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-border/80 bg-card/60 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Search Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by slug, alias, provider..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 text-xs font-mono h-9 bg-background/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* 2. Provider Filter */}
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
            <SelectTrigger className="h-9 text-xs bg-background/50 font-mono">
              <SelectValue placeholder="Filter by Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all" className="text-xs font-sans">
                  All Providers ({models.length})
                </SelectItem>
                {availableProviders.map((p) => {
                  const count = models.filter((m) => m.providerId === p).length;
                  return (
                    <SelectItem key={p} value={p} className="text-xs font-mono uppercase">
                      {p} ({count})
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* 3. Capability Filter */}
          <Select value={selectedCapability} onValueChange={setSelectedCapability}>
            <SelectTrigger className="h-9 text-xs bg-background/50">
              <SelectValue placeholder="Filter by Capability" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all" className="text-xs font-sans">
                  All Capabilities
                </SelectItem>
                {availableCapabilities.map((cap) => (
                  <SelectItem key={cap} value={cap} className="text-xs font-mono">
                    {cap}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* 4. Sort By */}
          <Select value={sortBy} onValueChange={(val: 'slug' | 'context' | 'provider') => setSortBy(val)}>
            <SelectTrigger className="h-9 text-xs bg-background/50">
              <SelectValue placeholder="Sort Catalog" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="slug" className="text-xs font-sans">
                  Sort: Slug (A-Z)
                </SelectItem>
                <SelectItem value="context" className="text-xs font-sans">
                  Sort: Context Window (High-Low)
                </SelectItem>
                <SelectItem value="provider" className="text-xs font-sans">
                  Sort: Upstream Provider
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter Chips Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium text-[11px] mr-1">Status:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({models.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('enabled')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === 'enabled'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              Enabled ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('disabled')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === 'disabled'
                  ? 'bg-destructive text-destructive-foreground shadow-sm'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              Disabled ({models.length - activeCount})
            </button>
          </div>

          <div className="text-[11px] text-muted-foreground font-mono">
            Showing <span className="font-semibold text-foreground">{filteredModels.length}</span> of {models.length} models
          </div>
        </div>
      </div>

      {/* Models Data Table */}
      <div className="rounded-xl border border-border/80 bg-card/60 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">Status</TableHead>
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
            ) : filteredModels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-36 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2 py-6">
                    <Layers className="size-7 text-muted-foreground/40" />
                    <span className="text-sm font-medium text-foreground">No matching models found</span>
                    <span className="text-xs text-muted-foreground max-w-sm">
                      {hasActiveFilters
                        ? 'Try clearing or relaxing your search query and filters.'
                        : 'Configure a provider and trigger "Sync Models" to populate this catalog.'}
                    </span>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetFilters}
                        className="mt-2 text-xs"
                      >
                        Reset All Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredModels.map((m) => {
                const currentAliasVal = editingAliases[m.slug] ?? m.customAlias ?? '';
                const isToggling =
                  toggleMutation.isPending && toggleMutation.variables?.slug === m.slug;
                const isSavingAlias =
                  aliasMutation.isPending && aliasMutation.variables?.slug === m.slug;

                return (
                  <TableRow key={m.slug} className="hover:bg-muted/40 transition-colors">
                    {/* Status Toggle with Live Spinner Loading */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        {isToggling ? (
                          <Loader2 className="size-4 animate-spin text-primary" />
                        ) : (
                          <Switch
                            checked={m.isEnabled}
                            disabled={isToggling}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({ slug: m.slug, isEnabled: checked })
                            }
                          />
                        )}
                      </div>
                    </TableCell>

                    {/* Model Slug */}
                    <TableCell className="font-mono text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">{m.slug}</span>
                        {m.customAlias && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 font-normal border-primary/30 text-primary bg-primary/10"
                          >
                            alias: {m.customAlias}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Provider Badge */}
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wide">
                        {m.providerId}
                      </Badge>
                    </TableCell>

                    {/* Capability Badges */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                              cap === 'chat'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : cap === 'tts'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : cap === 'stt'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-secondary text-secondary-foreground border-border'
                            }`}
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </TableCell>

                    {/* Context Window */}
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {m.contextWindow ? `${Math.round(m.contextWindow / 1024)}k` : '—'}
                    </TableCell>

                    {/* Routable Alias Input with Saving Spinner Loading */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 max-w-[200px] relative">
                        {isSavingAlias ? (
                          <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                        ) : (
                          <Tag className="size-3.5 text-muted-foreground shrink-0" />
                        )}
                        <Input
                          placeholder="e.g. fast-chat"
                          value={currentAliasVal}
                          disabled={isSavingAlias}
                          onChange={(e) =>
                            setEditingAliases({ ...editingAliases, [m.slug]: e.target.value })
                          }
                          onBlur={() => handleSaveAlias(m.slug)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveAlias(m.slug);
                          }}
                          className="h-7 text-xs font-mono py-0 px-2 bg-background/40"
                        />
                      </div>
                    </TableCell>

                    {/* Dropdown Menu Actions */}
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
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={isToggling}
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
