import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Card, CardContent } from '../components/ui/card.js';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table.js';
import { Badge } from '../components/ui/badge.js';
import { Input } from '../components/ui/input.js';
import { Button } from '../components/ui/button.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group.js';
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../components/ui/select.js';
import {
  Activity,
  Timer,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils.js';

export function LogsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const { data, isLoading } = useQuery({
    queryKey: ['telemetry-logs'],
    queryFn: () => api.getLogs(500),
    refetchInterval: 5000, // auto-refresh logs every 5s
  });

  const logs = data?.logs || [];

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleStatusChange = (val: 'all' | 'success' | 'error') => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        log.modelSlug.toLowerCase().includes(q) ||
        log.providerId.toLowerCase().includes(q);

      const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'success' && isSuccess) ||
        (statusFilter === 'error' && !isSuccess);

      return matchesSearch && matchesStatus;
    });
  }, [logs, search, statusFilter]);

  // Aggregate stats over total fetched logs
  const totalCount = logs.length;
  const successCount = logs.filter((l) => l.statusCode >= 200 && l.statusCode < 300).length;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
  const avgLatency =
    totalCount > 0 ? Math.round(logs.reduce((acc, l) => acc + l.latencyMs, 0) / totalCount) : 0;

  // Pagination calculation
  const totalFiltered = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedLogs = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, safeCurrentPage, pageSize]);

  const fromRecord = totalFiltered === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const toRecord = Math.min(safeCurrentPage * pageSize, totalFiltered);

  // Generate page numbers
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
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* Page Title & Live Indicators */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Request Telemetry &amp; Logs</h1>
            <Badge
              variant="outline"
              className="gap-1.5 text-[11px] font-mono border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
            >
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
              </span>
              Live Polling (5s)
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Non-blocking asynchronous request metrics captured from Neon Serverless Postgres.
          </p>
        </div>

        {/* Quick summary badges */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="secondary" className="gap-1 font-mono text-xs">
            <Activity className="size-3 text-muted-foreground" />
            <span>{totalCount} Logs</span>
          </Badge>
          <Badge
            variant={successRate >= 95 ? 'outline' : 'destructive'}
            className="gap-1 font-mono text-xs border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
          >
            <CheckCircle2 className="size-3" />
            <span>{successRate}% Success</span>
          </Badge>
          <Badge variant="secondary" className="gap-1 font-mono text-xs">
            <Timer className="size-3 text-primary" />
            <span>Avg {avgLatency}ms</span>
          </Badge>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border/80 shadow-sm bg-card/60">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Filter by model slug or provider ID..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs font-mono bg-background/50"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <ToggleGroup
              type="single"
              value={statusFilter}
              onValueChange={(val) => {
                if (val) handleStatusChange(val as 'all' | 'success' | 'error');
              }}
              className="w-full sm:w-auto justify-start"
            >
              <ToggleGroupItem
                value="all"
                aria-label="All logs"
                className="h-8 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                All
              </ToggleGroupItem>
              <ToggleGroupItem
                value="success"
                aria-label="Success logs"
                className="h-8 px-3 text-xs data-[state=on]:bg-emerald-600 data-[state=on]:text-white"
              >
                2xx Success
              </ToggleGroupItem>
              <ToggleGroupItem
                value="error"
                aria-label="Error logs"
                className="h-8 px-3 text-xs data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground"
              >
                Errors
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table Card (Official shadcn Table Primitive) */}
      <Card className="border-border/80 shadow-sm overflow-hidden flex flex-col">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Timestamp</TableHead>
              <TableHead>Model Slug</TableHead>
              <TableHead className="w-28">Provider</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="w-20">Mode</TableHead>
              <TableHead className="w-24">TTFT</TableHead>
              <TableHead className="w-28 text-right">Total Latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-14" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-5 w-16 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : paginatedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                    <AlertCircle className="size-6 text-muted-foreground/40" />
                    <span className="text-sm font-medium text-foreground">No telemetry logs found</span>
                    <span className="text-xs text-muted-foreground">
                      {search || statusFilter !== 'all'
                        ? 'Try clearing your filters to see historical requests.'
                        : 'Run a prompt in the Playground or send an OpenAI SDK request to capture telemetry.'}
                    </span>
                    {(search || statusFilter !== 'all') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearch('');
                          setStatusFilter('all');
                          setCurrentPage(1);
                        }}
                        className="mt-2 text-xs"
                      >
                        Reset Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedLogs.map((log) => {
                const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                return (
                  <TableRow key={log.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{log.modelSlug}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wide">
                        {log.providerId}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={isSuccess ? 'outline' : 'destructive'}
                        className={`font-mono text-[10px] ${
                          isSuccess
                            ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                            : ''
                        }`}
                      >
                        {log.statusCode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {log.isStreaming ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                            Stream
                          </Badge>
                        ) : (
                          <span className="text-[11px]">JSON</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-amber-500">
                      {log.ttftMs ? `${log.ttftMs}ms` : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary font-semibold text-right">
                      {log.latencyMs}ms
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Official shadcn Pagination Component Toolbar */}
        {!isLoading && totalFiltered > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/40 bg-card/40 text-xs">
            {/* Left: Range and Totals */}
            <div className="flex items-center gap-1.5 text-muted-foreground order-2 sm:order-1">
              <span>
                Showing <span className="font-semibold text-foreground">{fromRecord}</span> to{' '}
                <span className="font-semibold text-foreground">{toRecord}</span> of{' '}
                <span className="font-semibold text-foreground">{totalFiltered}</span> logs
              </span>
              {totalFiltered !== logs.length && (
                <span className="text-[11px] text-muted-foreground/80 font-mono">
                  (filtered from {logs.length})
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
                      <ChevronsLeft className="size-4" />
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
                      <ChevronsRight className="size-4" />
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
                <SelectTrigger className="h-8 w-[72px] text-xs font-mono bg-background/50">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent align="end">
                  {[10, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)} className="text-xs font-mono">
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
