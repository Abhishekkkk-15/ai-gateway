import React, { useState } from 'react';
import { Card, CardContent } from '../components/ui/card.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Button } from '../components/ui/button.js';
import { Alert, AlertDescription } from '../components/ui/alert.js';
import { ThemeToggle } from '../components/ThemeToggle.js';
import { api } from '../lib/api.js';
import { Lock, ArrowRight, AlertCircle, Shield, Terminal } from 'lucide-react';

export interface LoginPageProps {
  onLoginSuccess: (user: { username: string }) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.login(username, password);
      onLoginSuccess(res.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4 md:p-10">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm md:max-w-4xl">
        <Card className="overflow-hidden border-border/80 shadow-2xl p-0 bg-card">
          <CardContent className="grid p-0 md:grid-cols-2">
            {/* Form Column */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6 sm:p-10 justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-sm">
                    <Shield className="size-4" />
                  </div>
                  <span className="font-bold text-lg tracking-tight">AI Gateway</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight mt-3">Welcome back</h1>
                <p className="text-xs text-muted-foreground">
                  Enter your administrator credentials to access the console.
                </p>
              </div>

              {error && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertCircle className="size-4" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-foreground" htmlFor="username">
                    Admin Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-foreground" htmlFor="password">
                      Admin Password
                    </Label>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <Button type="submit" className="w-full mt-2" disabled={isLoading}>
                  {isLoading ? (
                    <span>Authenticating...</span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Lock className="size-4" />
                      <span>Sign In to Console</span>
                      <ArrowRight className="size-4" />
                    </span>
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-between border-t border-border/50 pt-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5 font-mono">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span>Admin Session</span>
                </span>
                <span className="font-mono">v1.0.0</span>
              </div>
            </form>

            {/* Right Architecture Column */}
            <div className="relative hidden md:flex flex-col justify-between p-10 bg-zinc-950 text-white border-l border-border/40 overflow-hidden font-sans">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                  <Terminal className="size-3.5 text-zinc-400" />
                  <span>Gateway Architecture</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
                  Self-Hosted OpenAI SDK Gateway
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Unified reverse proxy routing completions, embeddings, and real-time audio through a single authenticated endpoint.
                </p>
              </div>

              {/* Clean Terminal Box */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 font-mono text-[11px] text-zinc-300 space-y-2">
                <div className="flex items-center justify-between text-zinc-500 pb-2 border-b border-zinc-800 text-[10px]">
                  <span>HTTP &amp; WebSocket Proxy</span>
                  <span className="text-emerald-400">PORT :3000</span>
                </div>
                <div className="space-y-1">
                  <p><span className="text-zinc-500"># Chat completions (SSE)</span></p>
                  <p className="text-zinc-200">POST /v1/chat/completions</p>
                  <p className="pt-1"><span className="text-zinc-500"># Embeddings</span></p>
                  <p className="text-zinc-200">POST /v1/embeddings</p>
                  <p className="pt-1"><span className="text-zinc-500"># Realtime audio (WS)</span></p>
                  <p className="text-zinc-200">GET  /v1/realtime</p>
                </div>
              </div>

              <div className="text-[11px] text-zinc-500 font-mono">
                OpenAI SDK Compatible · Standard Bearer Auth
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
