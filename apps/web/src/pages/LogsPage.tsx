import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  type ColumnDef,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { api, type RequestLogView } from '../lib/api.js';
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
import { Button } from '../components/ui/button.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group.js';
import { Separator } from '../components/ui/separator.js';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet.js';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '../components/ui/pagination.js';
import { ReactSelect, type SelectOption } from '../components/ui/react-select.js';
import {
  Activity,
  Timer,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronsLeft,
  ChevronsRight,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils.js';

const STATUS_FILTER_CHIP =
  'h-8 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground';

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatFullTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function DetailRow({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('text-right break-words', mono && 'font-mono text-xs')}>
        {children}
      </span>
    </div>
  );
}

const PAGE_SIZE_OPTIONS: SelectOption[] = [
  { label: '10', value: '10' },
  { label: '25', value: '25' },
  { label: '50', value: '50' },
  { label: '100', value: '100' },
];

export function LogsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'timestamp', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [selectedLog, setSelectedLog] = useState<RequestLogView | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['telemetry-logs'],
    queryFn: () => api.getLogs(500),
    refetchInterval: 5000, // auto-refresh logs every 5s
  });

  const logs = data?.logs || [];

  const statusFilteredLogs = useMemo(() => {
    if (statusFilter === 'all') return logs;
    return logs.filter((log) => {
      const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
      return statusFilter === 'success' ? isSuccess : !isSuccess;
    });
  }, [logs, statusFilter]);

  // Aggregate stats over total fetched logs
  const totalCount = logs.length;
  const successCount = logs.filter((l) => l.statusCode >= 200 && l.statusCode < 300).length;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
  const avgLatency =
    totalCount > 0 ? Math.round(logs.reduce((acc, l) => acc + l.latencyMs, 0) / totalCount) : 0;

  const globalFilterFn = useMemo<FilterFn<RequestLogView>>(
    () => (row, _columnId, filterValue) => {
      const query = String(filterValue ?? '').trim().toLowerCase();
      if (!query) return true;
      const log = row.original;
      return (
        log.modelSlug.toLowerCase().includes(query) ||
        log.providerId.toLowerCase().includes(query)
      );
    },
    []
  );

  const columns = useMemo<ColumnDef<RequestLogView>[]>(
    () => [
      {
        accessorKey: 'timestamp',
        header: 'Timestamp',
        size: 112,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
            {formatTime(row.original.timestamp)}
          </span>
        ),
      },
      {
        accessorKey: 'modelSlug',
        header: 'Model Slug',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold">{row.original.modelSlug}</span>
        ),
      },
      {
        accessorKey: 'providerId',
        header: 'Provider',
        size: 112,
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-mono uppercase">
            {row.original.providerId}
          </Badge>
        ),
      },
      {
        accessorKey: 'statusCode',
        header: 'Status',
        size: 80,
        cell: ({ row }) => {
          const isSuccess =
            row.original.statusCode >= 200 && row.original.statusCode < 300;
          return (
            <Badge variant={isSuccess ? 'success' : 'destructive'} className="font-mono">
              {row.original.statusCode}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'isStreaming',
        header: 'Mode',
        size: 80,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.isStreaming ? (
            <Badge variant="secondary" className="font-normal">
              Stream
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">JSON</span>
          ),
      },
      {
        accessorKey: 'ttftMs',
        header: 'TTFT',
        size: 96,
        cell: ({ row }) =>
          row.original.ttftMs ? (
            <span className="font-mono text-xs text-chart-3">{row.original.ttftMs}ms</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'latencyMs',
        header: 'Total Latency',
        size: 112,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-primary">
            {row.original.latencyMs}ms
          </span>
        ),
      },
      {
        id: 'details',
        header: '',
        size: 40,
        enableSorting: false,
        cell: () => <ChevronRight className="size-4 text-muted-foreground/60" />,
      },
    ],
    []
  );

  const table = useReactTable({
    data: statusFilteredLogs,
    columns,
    state: { sorting, globalFilter: search, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    onPaginationChange: setPagination,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(1, table.getPageCount());
  const currentPage = Math.min(pagination.pageIndex + 1, pageCount);
  const fromRecord = filteredCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const toRecord = Math.min(
    (pagination.pageIndex + 1) * pagination.pageSize,
    filteredCount
  );

  const pageNumbers = useMemo(() => {
    if (pageCount <= 5) {
      return Array.from({ length: pageCount }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 'ellipsis', pageCount];
    }
    if (currentPage >= pageCount - 2) {
      return [1, 'ellipsis', pageCount - 2, pageCount - 1, pageCount];
    }
    return [1, 'ellipsis', currentPage, 'ellipsis', pageCount];
  }, [pageCount, currentPage]);

  const handleStatusChange = (val: 'all' | 'success' | 'error') => {
    setStatusFilter(val);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const hasFilters = search !== '' || statusFilter !== 'all';

  return (
    <div className="page-shell">
      {/* Page Title & Live Indicators */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="page-title">Request Telemetry &amp; Logs</h1>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-chart-2" />
              Live (5s)
            </span>
          </div>
          <p className="page-description">
            Request metrics, upstream latencies, status codes, and TTFT distributions.
          </p>
        </div>

        {/* Quick summary badges */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="secondary" className="gap-1">
            <Activity className="size-3 text-muted-foreground" />
            <span>{totalCount} Logs</span>
          </Badge>
          <Badge
            variant={successRate >= 95 ? 'success' : 'destructive'}
            className="gap-1"
          >
            <CheckCircle2 className="size-3" />
            <span>{successRate}% Success</span>
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Timer className="size-3 text-primary" />
            <span>Avg {avgLatency}ms</span>
          </Badge>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border bg-card">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <InputGroup className="flex-1 w-full">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Filter by model slug or provider ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
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
                      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                    }}
                  >
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
            <ToggleGroup
              type="single"
              value={statusFilter}
              onValueChange={(val) => {
                if (val) handleStatusChange(val as 'all' | 'success' | 'error');
              }}
              className="w-full sm:w-auto justify-start"
            >
              <ToggleGroupItem value="all" aria-label="All logs" className={STATUS_FILTER_CHIP}>
                All
              </ToggleGroupItem>
              <ToggleGroupItem
                value="success"
                aria-label="Success logs"
                className={STATUS_FILTER_CHIP}
              >
                2xx Success
              </ToggleGroupItem>
              <ToggleGroupItem value="error" aria-label="Error logs" className={STATUS_FILTER_CHIP}>
                Errors
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table Card (TanStack Table + Sheet details) */}
      <Card className="border-border overflow-hidden flex flex-col">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className={cn(canSort && 'cursor-pointer select-none')}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort &&
                            (sorted === 'asc' ? (
                              <ArrowUp className="size-3 text-primary" />
                            ) : sorted === 'desc' ? (
                              <ArrowDown className="size-3 text-primary" />
                            ) : (
                              <ArrowUpDown className="size-3 opacity-40" />
                            ))}
                        </span>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
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
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-4" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <AlertCircle />
                      </EmptyMedia>
                      <EmptyTitle>No telemetry logs found</EmptyTitle>
                      <EmptyDescription>
                        {hasFilters
                          ? 'Try clearing your filters to see historical requests.'
                          : 'Run a prompt in the Playground or send an OpenAI SDK request to capture telemetry.'}
                      </EmptyDescription>
                    </EmptyHeader>
                    {hasFilters && (
                      <EmptyContent>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetFilters}
                          className="text-xs"
                        >
                          Reset Filters
                        </Button>
                      </EmptyContent>
                    )}
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const log = row.original;
                const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                return (
                  <TableRow
                    key={row.id}
                    tabIndex={0}
                    onClick={() => setSelectedLog(log)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedLog(log);
                      }
                    }}
                    className="cursor-pointer hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:bg-muted/60"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination toolbar */}
        {!isLoading && filteredCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border bg-card text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground order-2 sm:order-1">
              <span>
                Showing <span className="font-semibold text-foreground">{fromRecord}</span> to{' '}
                <span className="font-semibold text-foreground">{toRecord}</span> of{' '}
                <span className="font-semibold text-foreground">{filteredCount}</span> logs
              </span>
              {filteredCount !== logs.length && (
                <span className="text-xs text-muted-foreground">
                  (filtered from {logs.length})
                </span>
              )}
            </div>

            <div className="order-1 sm:order-2">
              <Pagination>
                <PaginationContent className="gap-1">
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      disabled={currentPage === 1}
                      onClick={() => table.setPageIndex(0)}
                      title="First page"
                    >
                      <ChevronsLeft />
                    </Button>
                  </PaginationItem>

                  <PaginationItem>
                    <PaginationPrevious
                      className={cn(
                        'h-8 px-2.5 text-xs',
                        !table.getCanPreviousPage() && 'pointer-events-none opacity-50'
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        table.previousPage();
                      }}
                    />
                  </PaginationItem>

                  {pageNumbers.map((p, idx) =>
                    p === 'ellipsis' ? (
                      <PaginationItem key={`ellipsis-${idx}`}>
                        <PaginationEllipsis className="size-8" />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={p === currentPage}
                          className="size-8 text-xs font-mono"
                          onClick={(e) => {
                            e.preventDefault();
                            table.setPageIndex((p as number) - 1);
                          }}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}

                  <PaginationItem>
                    <PaginationNext
                      className={cn(
                        'h-8 px-2.5 text-xs',
                        !table.getCanNextPage() && 'pointer-events-none opacity-50'
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        table.nextPage();
                      }}
                    />
                  </PaginationItem>

                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      disabled={currentPage === pageCount}
                      onClick={() => table.setPageIndex(pageCount - 1)}
                      title="Last page"
                    >
                      <ChevronsRight />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>

            <div className="flex items-center gap-2 order-3">
              <span className="text-muted-foreground whitespace-nowrap">Rows per page</span>
              <div className="w-[80px]">
                <ReactSelect
                  options={PAGE_SIZE_OPTIONS}
                  value={String(pagination.pageSize)}
                  onValueChange={(val) => table.setPageSize(Number(val))}
                  size="sm"
                  isSearchable={false}
                />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Request detail sheet */}
      <Sheet open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto custom-scrollbar sm:max-w-md"
        >
          {selectedLog && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 pr-6">
                  <SheetTitle>Request details</SheetTitle>
                  <Badge
                    variant={
                      selectedLog.statusCode >= 200 && selectedLog.statusCode < 300
                        ? 'success'
                        : 'destructive'
                    }
                    className="font-mono"
                  >
                    {selectedLog.statusCode}
                  </Badge>
                </div>
                <SheetDescription className="break-all font-mono text-xs">
                  {selectedLog.id}
                </SheetDescription>
              </SheetHeader>

              <Separator className="my-5" />

              <div className="flex flex-col gap-3">
                <DetailRow label="Timestamp">
                  {formatFullTimestamp(selectedLog.timestamp)}
                </DetailRow>
                <DetailRow label="Model" mono>
                  {selectedLog.modelSlug}
                </DetailRow>
                <DetailRow label="Provider">
                  <Badge variant="secondary" className="font-mono uppercase">
                    {selectedLog.providerId}
                  </Badge>
                </DetailRow>
                <DetailRow label="Mode">
                  {selectedLog.isStreaming ? 'Streaming (SSE)' : 'Buffered JSON'}
                </DetailRow>
                <DetailRow label="TTFT" mono>
                  {selectedLog.ttftMs ? `${selectedLog.ttftMs}ms` : '—'}
                </DetailRow>
                <DetailRow label="Total latency" mono>
                  {selectedLog.latencyMs}ms
                </DetailRow>
                <DetailRow label="Prompt tokens" mono>
                  {selectedLog.promptTokens ?? '—'}
                </DetailRow>
                <DetailRow label="Completion tokens" mono>
                  {selectedLog.completionTokens ?? '—'}
                </DetailRow>
                <DetailRow label="Gateway key" mono>
                  {selectedLog.gatewayKeyId ?? '—'}
                </DetailRow>
              </div>

              {selectedLog.errorMessage && (
                <>
                  <Separator className="my-5" />
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-destructive">
                      <AlertCircle className="size-3.5" />
                      Upstream error
                    </div>
                    <p className="break-words font-mono text-xs text-muted-foreground">
                      {selectedLog.errorMessage}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
