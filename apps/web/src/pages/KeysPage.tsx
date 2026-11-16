import React, { useState, useMemo } from 'react';
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
import { Label } from '../components/ui/label.js';
import { Badge } from '../components/ui/badge.js';
import { Switch } from '../components/ui/switch.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import { Alert, AlertDescription } from '../components/ui/alert.js';
import { CodeBlock, InlineCode } from '../components/ui/code-block.js';
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
  const [codeTab, setCodeTab] = useState<'python' | 'node' | 'rust' | 'curl'>('python');

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

  const currentSnippet = useMemo(() => {
    if (codeTab === 'python') {
      return `from openai import OpenAI

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
    print(chunk.choices[0].delta.content or "", end="")`;
    }
    if (codeTab === 'node') {
      return `import OpenAI from 'openai';

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
}`;
    }
    if (codeTab === 'rust') {
      return `use async_openai::{
    config::OpenAIConfig,
    types::{ChatCompletionRequestUserMessageArgs, CreateChatCompletionRequestArgs},
    Client,
};
use futures::StreamExt;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Route requests to the AI Gateway with custom base URL and gateway key
    let config = OpenAIConfig::new()
        .with_api_base("${window.location.origin}/v1")
        .with_api_key("${testKeyPrefix}");

    let client = Client::with_config(config);

    let request = CreateChatCompletionRequestArgs::default()
        .model("groq/llama-3.3-70b-versatile")
        .messages([ChatCompletionRequestUserMessageArgs::default()
            .content("Hello via AI Gateway!")
            .build()?
            .into()])
        .build()?;

    let mut stream = client.chat().create_stream(request).await?;

    while let Some(result) = stream.next().await {
        match result {
            Ok(response) => {
                for choice in response.choices {
                    if let Some(content) = choice.delta.content {
                        print!("{content}");
                    }
                }
            }
            Err(err) => eprintln!("Error: {err}"),
        }
    }

    Ok(())
}`;
    }
    return `curl ${window.location.origin}/v1/chat/completions \\
  -H "Authorization: Bearer ${testKeyPrefix}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "groq/llama-3.3-70b-versatile",
    "messages": [{"role": "user", "content": "Hello via curl!"}],
    "stream": true
  }'`;
  }, [codeTab, testKeyPrefix]);

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

            <Tabs value={codeTab} onValueChange={(val) => setCodeTab(val as 'python' | 'node' | 'rust' | 'curl')} className="self-start sm:self-auto">
              <TabsList className="h-8">
                {(['python', 'node', 'rust', 'curl'] as const).map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="text-xs font-mono uppercase h-7 px-3">
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <CodeBlock
            code={currentSnippet}
            language={codeTab}
            showLineNumbers
          />
        </CardContent>
      </Card>

      {/* Create Key Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Generate Gateway API Key</DialogTitle>
              <DialogDescription>
                Creates a new secret key (<InlineCode>sk-gw-...</InlineCode>) for client authentication.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Key Name / Client ID</Label>
                <Input
                  placeholder="e.g. Production Backend, Dev Playground"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Rate Limit RPM (optional)</Label>
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

            {newlyCreatedKey && (
              <CodeBlock code={newlyCreatedKey} className="my-2" />
            )}

            <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-500 text-xs py-2.5">
              <AlertTriangle className="size-4 text-amber-500" />
              <AlertDescription className="text-amber-500 text-xs leading-relaxed">
                Store this key securely in your environment variables. Never commit it to source control.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button onClick={() => setNewlyCreatedKey(null)}>Done</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
