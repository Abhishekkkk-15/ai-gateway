import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type RequestLogView } from '../lib/api.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.js';
import { Badge } from '../components/ui/Badge.js';
import { Activity, Zap, Timer, CheckCircle2, AlertCircle } from 'lucide-react';

export function LogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['telemetry-logs'],
    queryFn: () => api.getLogs(100),
    refetchInterval: 5000, // auto-refresh logs every 5s
  });

  const logs = data?.logs || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Request Telemetry &amp; Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Non-blocking asynchronous request metrics captured from Neon Serverless Postgres.
        </p>
      </div>

      <Card className="border-border/80">
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
              <TableRow>
                <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                  Loading telemetry logs...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                  No telemetry recorded yet. Run a prompt in the Playground or connect an OpenAI SDK client.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                return (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{log.modelSlug}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {log.providerId}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isSuccess ? 'success' : 'destructive'} className="font-mono text-[10px]">
                        {log.statusCode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.isStreaming ? 'SSE Stream' : 'JSON'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-amber-400">
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
