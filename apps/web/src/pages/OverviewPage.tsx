import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type RequestLogView } from '../lib/api.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
  CardFooter,
} from '../components/ui/card.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table.js';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Activity,
  Cpu,
  Layers,
  Zap,
  Timer,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';

export function OverviewPage({
  onNavigate,
}: {
  onNavigate?: (tab: 'providers' | 'models' | 'keys' | 'playground' | 'logs') => void;
}) {
  const navigate = useNavigate();
  const [metricTab, setMetricTab] = useState<'latency' | 'volume'>('latency');

  const handleNav = (tab: 'providers' | 'models' | 'keys' | 'playground' | 'logs') => {
    if (onNavigate) {
      onNavigate(tab);
    } else {
      navigate(`/${tab}`);
    }
  };

  const { data: logsData, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['logs'],
    queryFn: () => api.getLogs(50),
    refetchInterval: 5000,
  });

  const { data: providersData, isLoading: isLoadingProviders } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.getProviders(),
  });

  const { data: modelsData, isLoading: isLoadingModels } = useQuery({
    queryKey: ['models'],
    queryFn: () => api.getModels(),
  });

  const logs = logsData?.logs || [];
  const providers = providersData?.providers || [];
  const models = modelsData?.models || [];

  const enabledProviders = providers.filter((p) => p.isEnabled);
  const enabledModels = models.filter((m) => m.isEnabled);

  const totalRequests = logs.length;
  const avgLatency =
    totalRequests > 0
      ? Math.round(logs.reduce((acc, l) => acc + (l.latencyMs || 0), 0) / totalRequests)
      : 0;

  const validTtftLogs = logs.filter((l) => l.ttftMs !== null && l.ttftMs !== undefined);
  const avgTtft =
    validTtftLogs.length > 0
      ? Math.round(validTtftLogs.reduce((acc, l) => acc + (l.ttftMs || 0), 0) / validTtftLogs.length)
      : 0;

  // Build chart timeline data from real logs (empty if none)
  const chartData =
    logs.length > 0
      ? [...logs].reverse().map((log, idx) => ({
          index: idx + 1,
          time: new Date(log.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          latency: log.latencyMs,
          ttft: log.ttftMs || 0,
          status: log.statusCode,
        }))
      : [];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Request metrics, latency distributions, and active provider status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleNav('playground')}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <span>Open Playground</span>
            <ArrowUpRight className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNav('providers')}
            className="flex items-center gap-1.5"
          >
            <span>Configure Providers</span>
          </Button>
        </div>
      </div>

      {/* KPI Section Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Requests */}
        <Card className="border-border/80 shadow-sm hover:border-border transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Requests
            </CardTitle>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingLogs ? (
              <Skeleton className="h-8 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold tracking-tight">{totalRequests}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {totalRequests === 1 ? '1 request recorded' : `${totalRequests} requests recorded`}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Active Models */}
        <Card className="border-border/80 shadow-sm hover:border-border transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Models
            </CardTitle>
            <Layers className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingModels ? (
              <Skeleton className="h-8 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold tracking-tight">
                {enabledModels.length}
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  / {models.length} total
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              <span>{enabledModels.length} active in routing table</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Providers Live */}
        <Card className="border-border/80 shadow-sm hover:border-border transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Configured Providers
            </CardTitle>
            <Cpu className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingProviders ? (
              <Skeleton className="h-8 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold tracking-tight">
                {enabledProviders.length}
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  / {providers.length}
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              <span>{enabledProviders.length} active upstream providers</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Avg Latency / TTFT */}
        <Card className="border-border/80 shadow-sm hover:border-border transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg TTFT / Latency
            </CardTitle>
            <Timer className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingLogs ? (
              <Skeleton className="h-8 w-24 my-1" />
            ) : (
              <div className="text-2xl font-bold tracking-tight">
                {avgTtft > 0 ? `${avgTtft}ms` : '—'}
                <span className="text-xs text-muted-foreground font-normal ml-1.5">
                  ({avgLatency}ms total)
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              <span>{validTtftLogs.length} streaming responses</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Telemetry Chart */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 gap-4">
          <div>
            <CardTitle className="text-base font-semibold">Latency &amp; TTFT Distribution</CardTitle>
            <CardDescription>
              Chronological streaming performance across upstream providers
            </CardDescription>
          </div>
          <Tabs value={metricTab} onValueChange={(val) => setMetricTab(val as 'latency' | 'volume')}>
            <TabsList className="h-8">
              <TabsTrigger value="latency" className="text-xs h-7">
                Latency (ms)
              </TabsTrigger>
              <TabsTrigger value="volume" className="text-xs h-7">
                TTFT (ms)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-[280px] w-full flex flex-col items-center justify-center text-center p-6 border border-dashed rounded-lg border-border/60">
              <Activity className="size-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-foreground">No telemetry recorded yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Requests processed by the gateway will display real-time latency and TTFT metrics here.
              </p>
            </div>
          ) : (
            <div className="h-[280px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="ttftGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="time"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}ms`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border border-border bg-popover p-2.5 shadow-md text-xs font-mono">
                            <p className="font-semibold text-foreground mb-1">{data.time}</p>
                            <p className="text-emerald-500">Total Latency: {data.latency}ms</p>
                            <p className="text-amber-500">TTFT: {data.ttft}ms</p>
                            {data.status && (
                              <p className="text-muted-foreground mt-0.5">Status: {data.status}</p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={metricTab === 'latency' ? 'latency' : 'ttft'}
                    stroke={metricTab === 'latency' ? '#10b981' : '#f59e0b'}
                    strokeWidth={2}
                    fill={metricTab === 'latency' ? 'url(#latencyGradient)' : 'url(#ttftGradient)'}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between border-t border-border/60 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Batched telemetry logging active</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNav('logs')}
            className="text-xs h-7 text-muted-foreground hover:text-foreground"
          >
            <span>View All Logs</span>
            <ArrowUpRight className="size-3 ml-1" />
          </Button>
        </CardFooter>
      </Card>

      {/* Recent Invocations Table */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Recent Invocations</CardTitle>
            <CardDescription>Latest telemetry events processed by the gateway</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNav('logs')}
            className="text-xs h-8"
          >
            Open Logs
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Timestamp</TableHead>
                <TableHead>Model Slug</TableHead>
                <TableHead className="w-28">Provider</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-24">TTFT</TableHead>
                <TableHead className="w-24 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingLogs ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell colSpan={6} className="py-2.5">
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground font-sans italic">
                    No requests recorded yet. Test an inference in the Playground or send an OpenAI SDK call.
                  </TableCell>
                </TableRow>
              ) : (
                logs.slice(0, 5).map((log) => {
                  const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                  return (
                    <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="py-2.5 text-muted-foreground whitespace-nowrap font-mono text-xs">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="py-2.5 font-semibold text-foreground font-mono text-xs">{log.modelSlug}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                          {log.providerId}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isSuccess ? 'outline' : 'destructive'}
                          className={`text-[10px] font-mono ${
                            isSuccess
                              ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                              : ''
                          }`}
                        >
                          {log.statusCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-amber-500 font-mono text-xs">{log.ttftMs ? `${log.ttftMs}ms` : '—'}</TableCell>
                      <TableCell className="py-2.5 text-primary font-semibold font-mono text-xs text-right">{log.latencyMs}ms</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
