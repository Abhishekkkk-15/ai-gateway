import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type GatewayKeyView } from '../lib/api.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/ui/card.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Badge } from '../components/ui/badge.js';
import { Switch } from '../components/ui/switch.js';
import { Skeleton } from '../components/ui/skeleton.js';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog.js';
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  Code2,
  ShieldAlert,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

export function KeysPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRpm, setNewKeyRpm] = useState<number | ''>('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<'python' | 'node' | 'curl'>('python');

  const { data, isLoading } = useQuery({
    queryKey: ['gateway-keys'],
    queryFn: () => api.getGatewayKeys(),
  });

  const createMutation = useMutation({
    mutationFn: (vars: { name: string; rateLimitRpm?: number }) =>
      api.createGatewayKey(vars),
    onSuccess: (res) => {
      setNewlyCreatedKey(res.apiKey);
      setIsCreateOpen(false);
      setNewKeyName('');
      setNewKeyRpm('');
      toast.success('Gateway API key created successfully!');
      void queryClient.invalidateQueries({ queryKey: ['gateway-keys'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create key');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteGatewayKey(id),
    onSuccess: () => {
      toast.success('Gateway key revoked.');
      void queryClient.invalidateQueries({ queryKey: ['gateway-keys'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke key');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      api.updateGatewayKey(id, { isEnabled }),
    onSuccess: (_, vars) => {
      toast.success(`Key ${vars.isEnabled ? 'enabled' : 'disabled'}`);
      void queryClient.invalidateQueries({ queryKey: ['gateway-keys'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update key status');
    },
  });

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    createMutation.mutate({
      name: newKeyName.trim(),
      rateLimitRpm: typeof newKeyRpm === 'number' ? newKeyRpm : undefined,
    });
  };

  const keys = data?.keys || [];
  const testKeyPrefix = keys.length > 0 ? `${keys[0].prefix}...` : 'sk-gw-YOUR_KEY';

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Gateway API Keys</h1>
            <Badge variant="outline" className="text-xs font-mono">
              {keys.length} Keys Active
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and manage access tokens for client applications. All requests route through the Zero-DB memory lookup.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
        >
          <Plus className="size-4" />
          <span>Generate New Key</span>
        </Button>
      </div>

      {/* Keys Table Card */}
      <Card className="border-border/80 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key Name</TableHead>
              <TableHead>Key Token Prefix</TableHead>
              <TableHead>Rate Limit</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Revoke</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-5 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="size-8 rounded ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1 py-4">
                    <KeyRound className="size-6 text-muted-foreground/40 mb-1" />
                    <span className="text-sm font-medium text-foreground">No gateway keys generated yet</span>
                    <span className="text-xs text-muted-foreground">Click &quot;Generate New Key&quot; above to issue your first client token.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              keys.map((k) => (
                <TableRow key={k.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="font-medium text-sm">{k.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{k.prefix}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {k.rateLimitRpm ? `${k.rateLimitRpm} RPM` : 'Unlimited'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {toggleMutation.isPending && toggleMutation.variables?.id === k.id ? (
                        <Loader2 className="size-4 animate-spin text-primary" />
                      ) : (
                        <Switch
                          checked={k.isEnabled}
                          disabled={toggleMutation.isPending && toggleMutation.variables?.id === k.id}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: k.id, isEnabled: checked })
                          }
                        />
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          k.isEnabled
                            ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {k.isEnabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleteMutation.isPending && deleteMutation.variables === k.id}
                      onClick={() => deleteMutation.mutate(k.id)}
                      className="text-destructive hover:bg-destructive/10 size-8 p-0"
                    >
                      {deleteMutation.isPending && deleteMutation.variables === k.id ? (
                        <Loader2 className="size-4 animate-spin text-destructive" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Quickstart Code Snippets */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Code2 className="size-5 text-primary" />
              <div>
                <CardTitle className="text-base font-semibold">OpenAI SDK Integration</CardTitle>
                <CardDescription>
                  Drop the gateway URL directly into your existing OpenAI SDK client code without changing code logic.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-start sm:self-auto">
              {(['python', 'node', 'curl'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCodeTab(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-mono uppercase transition-all ${
                    codeTab === tab
                      ? 'bg-background text-foreground shadow-sm font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="rounded-lg border border-border bg-black/60 p-4 font-mono text-xs overflow-x-auto text-zinc-100 leading-relaxed shadow-inner">
              {codeTab === 'python' &&
                `from openai import OpenAI

client = OpenAI(
    base_url="${window.location.origin}/v1",
    api_key="${testKeyPrefix}"
)

# Call any upstream model through the Gateway
response = client.chat.completions.create(
    model="groq/llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "Hello via AI Gateway!"}],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")`}

              {codeTab === 'node' &&
                `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: '${window.location.origin}/v1',
  apiKey: '${testKeyPrefix}',
});

const stream = await client.chat.completions.create({
  model: 'groq/llama-3.3-70b-versatile',
  messages: [{ role: 'user', content: 'Hello via AI Gateway!' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}`}

              {codeTab === 'curl' &&
                `curl ${window.location.origin}/v1/chat/completions \\
  -H "Authorization: Bearer ${testKeyPrefix}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "groq/llama-3.3-70b-versatile",
    "messages": [{"role": "user", "content": "Hello via curl!"}],
    "stream": true
  }'`}
            </pre>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const code =
                  codeTab === 'python'
                    ? `from openai import OpenAI\n\nclient = OpenAI(base_url="${window.location.origin}/v1", api_key="${testKeyPrefix}")\nresponse = client.chat.completions.create(model="groq/llama-3.3-70b-versatile", messages=[{"role": "user", "content": "Hello!"}], stream=True)\nfor chunk in response: print(chunk.choices[0].delta.content or "", end="")`
                    : codeTab === 'node'
                      ? `import OpenAI from 'openai';\n\nconst client = new OpenAI({ baseURL: '${window.location.origin}/v1', apiKey: '${testKeyPrefix}' });\nconst stream = await client.chat.completions.create({ model: 'groq/llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'Hello!' }], stream: true });`
                      : `curl ${window.location.origin}/v1/chat/completions -H "Authorization: Bearer ${testKeyPrefix}" -H "Content-Type: application/json" -d '{"model": "groq/llama-3.3-70b-versatile", "messages": [{"role": "user", "content": "Hello!"}], "stream": true}'`;
                handleCopy(code, codeTab);
              }}
              className="absolute top-3 right-3 text-xs bg-background/80 backdrop-blur-sm"
            >
              {copiedText === codeTab ? (
                <Check className="size-3.5 text-emerald-400 mr-1.5" />
              ) : (
                <Copy className="size-3.5 mr-1.5" />
              )}
              <span>{copiedText === codeTab ? 'Copied' : 'Copy Code'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Key Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Generate Gateway API Key</DialogTitle>
              <DialogDescription>
                Creates a new secret key (`sk-gw-...`) for client authentication.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Key Name / Client ID</label>
                <Input
                  placeholder="e.g. Production Backend, Dev Playground"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Rate Limit RPM (optional)</label>
                <Input
                  type="number"
                  placeholder="Unlimited (e.g. 60)"
                  value={newKeyRpm}
                  onChange={(e) => setNewKeyRpm(e.target.value ? Number(e.target.value) : '')}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    <span>Creating Key...</span>
                  </>
                ) : (
                  <span>Create Key</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Newly Created Key Display Modal */}
      <Dialog open={Boolean(newlyCreatedKey)} onOpenChange={() => setNewlyCreatedKey(null)}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <div className="flex items-center gap-2 text-emerald-500 mb-1">
                <Check className="size-5" />
                <DialogTitle className="text-lg">Gateway Key Created</DialogTitle>
              </div>
              <DialogDescription>
                Copy this API key now. It is hashed before storage and cannot be displayed again.
              </DialogDescription>
            </DialogHeader>

            <div className="my-2 p-3 rounded-lg bg-secondary/80 border border-border flex items-center justify-between">
              <span className="font-mono text-xs text-primary break-all select-all">
                {newlyCreatedKey}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => newlyCreatedKey && handleCopy(newlyCreatedKey, 'new-key')}
                className="ml-3 shrink-0"
              >
                {copiedText === 'new-key' ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>

            <div className="flex items-start gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 p-3 rounded-md">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>Store this key securely in your environment variables. Never commit it to source control.</span>
            </div>

            <DialogFooter>
              <Button onClick={() => setNewlyCreatedKey(null)}>Done</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
