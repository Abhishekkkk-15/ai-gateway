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
import { Spinner } from '../components/ui/spinner.js';
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
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group.js';
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '../components/ui/pagination.js';
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
  X,
  SlidersHorizontal,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '../lib/utils.js';
import { AddModelDialog } from '../components/models/AddModelDialog.js';
import { Plus } from 'lucide-react';

export function ModelsPage() {
  const queryClient = useQueryClient();

  // Search and Filter States
  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedCapability, setSelectedCapability] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [sortBy, setSortBy] = useState<'slug' | 'context' | 'provider'>('slug');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Inline editing state
  const [editingAliases, setEditingAliases] = useState<Record<string, string>>({});
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [isAddingModel, setIsAddingModel] = useState(false);

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
    setCurrentPage(1);
  };

  const activeCount = models.filter((m) => m.isEnabled).length;

  // Pagination execution
  const totalFiltered = filteredModels.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedModels = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredModels.slice(start, start + pageSize);
  }, [filteredModels, safeCurrentPage, pageSize]);

  const fromRecord = totalFiltered === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const toRecord = Math.min(safeCurrentPage * pageSize, totalFiltered);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 3) {
      return [1, 2, 3, 'ellipsis', totalPages];
    }
    if (safeCurrentPage >= totalPages - 2) {
      return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, 'ellipsis', safeCurrentPage, 'ellipsis', totalPages];
  }, [totalPages, safeCurrentPage]);

  return (
    <div className="page-shell">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Models Catalog</h1>
            <Badge variant="secondary">
              {activeCount} / {models.length} Enabled
            </Badge>
          </div>
          <p className="page-description">
            Configure available models and set custom aliases to decouple client applications from provider IDs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw />
              <span>Reset Filters</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setIsAddingModel(true)}
            className="text-xs gap-1.5"
            title="Add model manually to catalog"
          >
            <Plus className="size-3.5" />
            <span>Add Model</span>
          </Button>
        </div>
      </div>

      {/* Filter and Controls Toolbar */}
      <div className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Search Filter */}
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search by slug, alias, provider..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs font-mono"
            />
            {search && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearch('');
                    setCurrentPage(1);
                  }}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>

          {/* 2. Provider Filter */}
          <Select
            value={selectedProvider}
            onValueChange={(val) => {
              setSelectedProvider(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs font-mono">
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
          <Select
            value={selectedCapability}
            onValueChange={(val) => {
              setSelectedCapability(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
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
            <SelectTrigger className="h-9 text-xs">
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
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium mr-1">Status:</span>
            <ToggleGroup
              type="single"
              value={statusFilter}
              onValueChange={(val) => {
                if (val) {
                  setStatusFilter(val as 'all' | 'enabled' | 'disabled');
                  setCurrentPage(1);
                }
              }}
              className="gap-1"
            >
              <ToggleGroupItem
                value="all"
                aria-label="All models"
                className="h-7 px-2.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                All ({models.length})
              </ToggleGroupItem>
              <ToggleGroupItem
                value="enabled"
                aria-label="Enabled models"
                className="h-7 px-2.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Enabled ({activeCount})
              </ToggleGroupItem>
              <ToggleGroupItem
                value="disabled"
                aria-label="Disabled models"
                className="h-7 px-2.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Disabled ({models.length - activeCount})
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredModels.length}</span> of {models.length} models
          </div>
        </div>
      </div>

      {/* Models Data Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
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
                <TableCell colSpan={7} className="p-0">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Layers />
                      </EmptyMedia>
                      <EmptyTitle>No matching models found</EmptyTitle>
                      <EmptyDescription>
                        {hasActiveFilters
                          ? 'Try clearing or relaxing your search query and filters.'
                          : 'Configure a provider and trigger "Sync Models" to populate this catalog.'}
                      </EmptyDescription>
                    </EmptyHeader>
                    {hasActiveFilters && (
                      <EmptyContent>
                        <Button variant="outline" size="sm" onClick={resetFilters} className="text-xs">
                          Reset All Filters
                        </Button>
                      </EmptyContent>
                    )}
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              paginatedModels.map((m) => {
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
                          <Spinner className="text-primary" />
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
                            variant="secondary"
                            className="font-normal"
                          >
                            alias: {m.customAlias}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Provider Badge */}
                    <TableCell>
                      <Badge variant="secondary" className="font-mono uppercase">
                        {m.providerId}
                      </Badge>
                    </TableCell>

                    {/* Capability Badges */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.capabilities.map((cap) => (
                          <Badge
                            key={cap}
                            variant="secondary"
                            className={cn(
                              'font-normal',
                              cap === 'chat'
                                ? 'text-primary'
                                : cap === 'tts'
                                  ? 'text-chart-3'
                                  : cap === 'stt'
                                    ? 'text-chart-2'
                                    : ''
                            )}
                          >
                            {cap}
                          </Badge>
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
                          <Spinner className="size-3.5 text-primary shrink-0" />
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
                          className="h-7 text-xs font-mono py-0 px-2"
                        />
                      </div>
                    </TableCell>

                    {/* Dropdown Menu Actions */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="size-8 p-0">
                            <MoreHorizontal />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel className="text-xs">Model Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleCopy(m.customAlias || m.slug)}>
                            <Copy />
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
                            <CheckCircle2 />
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

        {/* Official shadcn Pagination Component Toolbar */}
        {!isLoading && totalFiltered > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border bg-card text-xs">
            {/* Left: Range and Totals */}
            <div className="flex items-center gap-1.5 text-muted-foreground order-2 sm:order-1">
              <span>
                Showing <span className="font-semibold text-foreground">{fromRecord}</span> to{' '}
                <span className="font-semibold text-foreground">{toRecord}</span> of{' '}
                <span className="font-semibold text-foreground">{totalFiltered}</span> models
              </span>
              {totalFiltered !== models.length && (
                <span className="text-xs text-muted-foreground">
                  (filtered from {models.length})
                </span>
              )}
            </div>

            {/* Center: shadcn Pagination Links */}
            <div className="order-1 sm:order-2">
              <Pagination>
                <PaginationContent className="gap-1">
                  {/* First page button */}
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      disabled={safeCurrentPage === 1}
                      onClick={() => setCurrentPage(1)}
                      title="First page"
                    >
                      <ChevronsLeft />
                    </Button>
                  </PaginationItem>

                  {/* Previous page */}
                  <PaginationItem>
                    <PaginationPrevious
                      className={cn(
                        "h-8 px-2.5 text-xs",
                        safeCurrentPage === 1 && "pointer-events-none opacity-50"
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        if (safeCurrentPage > 1) setCurrentPage(safeCurrentPage - 1);
                      }}
                    />
                  </PaginationItem>

                  {/* Page numbers with ellipsis */}
                  {pageNumbers.map((p, idx) =>
                    p === 'ellipsis' ? (
                      <PaginationItem key={`ellipsis-${idx}`}>
                        <PaginationEllipsis className="size-8" />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={p === safeCurrentPage}
                          className="size-8 text-xs font-mono"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(p as number);
                          }}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}

                  {/* Next page */}
                  <PaginationItem>
                    <PaginationNext
                      className={cn(
                        "h-8 px-2.5 text-xs",
                        safeCurrentPage === totalPages && "pointer-events-none opacity-50"
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        if (safeCurrentPage < totalPages) setCurrentPage(safeCurrentPage + 1);
                      }}
                    />
                  </PaginationItem>

                  {/* Last page button */}
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      disabled={safeCurrentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      title="Last page"
                    >
                      <ChevronsRight />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>

            {/* Right: Page Size Selector */}
            <div className="flex items-center gap-2 order-3">
              <span className="text-muted-foreground whitespace-nowrap">Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[72px] text-xs font-mono">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent align="end">
                  {[10, 15, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)} className="text-xs font-mono">
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <AddModelDialog open={isAddingModel} onOpenChange={setIsAddingModel} />
    </div>
  );
}
