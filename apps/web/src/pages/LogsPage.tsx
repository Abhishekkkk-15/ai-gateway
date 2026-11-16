import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Input } from '../components/ui/input.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { Activity, Zap, Timer, CheckCircle2, AlertCircle, Search } from 'lucide-react';

export function LogsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['telemetry-logs'],
    queryFn: () => api.getLogs(100),
    refetchInterval: 5000, // auto-refresh logs every 5s
  });

  const logs = data?.logs || [];

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        search === '' ||
        log.modelSlug.toLowerCase().includes(search.toLowerCase()) ||
        log.providerId.toLowerCase().includes(search.toLowerCase());

      const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'success' && isSuccess) ||
        (statusFilter === 'error' && !isSuccess);

      return matchesSearch && matchesStatus;
    });
  }, [logs, search, statusFilter]);

  // Aggregate stats
  const totalCount = logs.length;
  const successCount = logs.filter((l) => l.statusCode >= 200 && l.statusCode < 300).length;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
  const avgLatency =
    totalCount > 0 ? Math.round(logs.reduce((acc, l) => acc + l.latencyMs, 0) / totalCount) : 0;

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
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs font-mono bg-background/50"
              />
            </div>
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('success')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  statusFilter === 'success'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-muted/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                2xx Success
              </button>
              <button
                onClick={() => setStatusFilter('error')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  statusFilter === 'error'
                    ? 'bg-destructive text-destructive-foreground shadow-sm'
                    : 'bg-muted/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                Errors
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table Card */}
      <Card className="border-border/80 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Model Slug</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>TTFT</TableHead>
              <TableHead>Total Latency</TableHead>
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
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredLogs.length === 0 ? (
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
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => {
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
                    <TableCell className="font-mono text-xs text-primary font-semibold">
                      {log.latencyMs}ms
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
