import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type GatewayKeyView } from '../lib/api.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.js';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/Dialog.js';
import { Key, Plus, Trash2, Copy, Check, Code2, AlertTriangle } from 'lucide-react';

export function KeysPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedSnippetTab, setSelectedSnippetTab] = useState<'ts' | 'python' | 'curl'>('ts');

  const { data, isLoading } = useQuery({
    queryKey: ['gateway-keys'],
    queryFn: () => api.getGatewayKeys(),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createGatewayKey({ name }),
    onSuccess: (res) => {
      setNewlyCreatedKey(res.apiKey);
      setKeyName('');
      void queryClient.invalidateQueries({ queryKey: ['gateway-keys'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteGatewayKey(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gateway-keys'] });
    },
  });

  const handleCopy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    createMutation.mutate(keyName.trim());
  };

  const keys = data?.keys || [];
  const gatewayBaseUrl = typeof window !== 'undefined' ? `${window.location.origin}/v1` : 'https://your-gateway.onrender.com/v1';
  const sampleKey = newlyCreatedKey || (keys.length > 0 ? `${keys[0].prefix}xxxx` : 'sk-gw-your-gateway-key');

  const tsSnippet = `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: '${gatewayBaseUrl}',
  apiKey: process.env.GATEWAY_API_KEY || '${sampleKey}',
});

const completion = await client.chat.completions.create({
  model: 'groq/llama-3.3-70b-versatile', // or short name / alias e.g. 'llama-3.3-70b-versatile'
  messages: [{ role: 'user', content: 'Explain zero-latency routing in one sentence.' }],
  stream: true,
});

for await (const chunk of completion) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}`;

  const pythonSnippet = `from openai import OpenAI
import os

client = OpenAI(
    base_url="${gatewayBaseUrl}",
    api_key=os.environ.get("GATEWAY_API_KEY", "${sampleKey}"),
)

stream = client.chat.completions.create(
    model="groq/llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "Explain zero-latency routing."}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="", flush=True)`;

  const curlSnippet = `curl -X POST "${gatewayBaseUrl}/chat/completions" \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "groq/llama-3.3-70b-versatile",
    "messages": [{"role": "user", "content": "Hello from OpenAI SDK!"}],
    "stream": false
  }'`;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gateway API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provision unified <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">sk-gw-...</code> keys for downstream client applications and services.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
          <Plus className="size-4" />
          <span>Generate New Key</span>
        </Button>
      </div>

      {/* Keys Table */}
      <Card className="border-border/80 overflow-hidden shadow-sm">
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
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Loading gateway keys...
                </TableCell>
              </TableRow>
            ) : keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No gateway keys generated yet. Click &quot;Generate New Key&quot; above.
                </TableCell>
              </TableRow>
            ) : (
              keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium text-sm">{k.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{k.prefix}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {k.rateLimitRpm ? `${k.rateLimitRpm} RPM` : 'Unlimited'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={k.isEnabled ? 'success' : 'secondary'}>
                      {k.isEnabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(k.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-destructive/10 size-8 p-0"
                    >
                      <Trash2 className="size-4" />
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
              <CardTitle className="text-base font-semibold">OpenAI SDK Quickstart</CardTitle>
            </div>
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setSelectedSnippetTab('ts')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  selectedSnippetTab === 'ts' ? 'bg-background text-foreground shadow' : 'text-muted-foreground'
                }`}
              >
                TypeScript
              </button>
              <button
                type="button"
                onClick={() => setSelectedSnippetTab('python')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  selectedSnippetTab === 'python' ? 'bg-background text-foreground shadow' : 'text-muted-foreground'
                }`}
              >
                Python
              </button>
              <button
                type="button"
                onClick={() => setSelectedSnippetTab('curl')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  selectedSnippetTab === 'curl' ? 'bg-background text-foreground shadow' : 'text-muted-foreground'
                }`}
              >
                cURL
              </button>
            </div>
          </div>
          <CardDescription className="text-xs">
            Point standard OpenAI SDK clients directly to this gateway. All routing, model resolution, and streaming are handled natively.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="relative rounded-lg bg-black/60 p-4 border border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const code =
                  selectedSnippetTab === 'ts'
                    ? tsSnippet
                    : selectedSnippetTab === 'python'
                      ? pythonSnippet
                      : curlSnippet;
                handleCopy(code, 'snippet');
              }}
              className="absolute right-3 top-3 h-8 text-xs flex items-center gap-1.5"
            >
              {copiedText === 'snippet' ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              <span>{copiedText === 'snippet' ? 'Copied' : 'Copy'}</span>
            </Button>
            <pre className="text-xs font-mono text-foreground/90 overflow-x-auto pr-16 leading-relaxed">
              {selectedSnippetTab === 'ts' && tsSnippet}
              {selectedSnippetTab === 'python' && pythonSnippet}
              {selectedSnippetTab === 'curl' && curlSnippet}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Create Key Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Generate Gateway API Key</DialogTitle>
            <DialogDescription>
              Create a new client credential. The secret key will be shown only once upon creation.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Key Name / Client Tag</label>
              <Input
                placeholder="e.g. Production Mobile App"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Key</Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Newly Created Key Display Modal */}
      <Dialog open={Boolean(newlyCreatedKey)} onOpenChange={() => setNewlyCreatedKey(null)}>
        <div className="flex flex-col gap-4">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-400 mb-1">
              <Check className="size-5" />
              <DialogTitle className="text-lg">Gateway Key Created</DialogTitle>
            </div>
            <DialogDescription>
              Copy this API key now. It is hashed before storage and cannot be displayed again.
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 p-3 rounded-lg bg-secondary/80 border border-border flex items-center justify-between">
            <span className="font-mono text-xs text-primary break-all select-all">{newlyCreatedKey}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => newlyCreatedKey && handleCopy(newlyCreatedKey, 'new-key')}
              className="ml-3 shrink-0"
            >
              {copiedText === 'new-key' ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
            </Button>
          </div>

          <div className="flex items-start gap-2 text-xs text-amber-400/90 bg-amber-950/20 border border-amber-900/40 p-3 rounded-md">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>Store this key securely in your environment variables. Never commit it to source control.</span>
          </div>

          <DialogFooter>
            <Button onClick={() => setNewlyCreatedKey(null)}>Done</Button>
          </DialogFooter>
        </div>
      </Dialog>
    </div>
  );
}
