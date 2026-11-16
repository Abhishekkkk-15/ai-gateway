import React, { useState } from 'react';
import { Card, CardContent } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { ThemeToggle } from '../components/ThemeToggle.js';
import { api } from '../lib/api.js';
import { Lock, ArrowRight, AlertCircle, ShieldCheck, Zap, Activity, Cpu } from 'lucide-react';

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
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg shadow-sm">
                    ⚡
                  </div>
                  <span className="font-bold text-lg tracking-tight">AI Gateway</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight mt-3">Welcome back</h1>
                <p className="text-xs text-muted-foreground">
                  Enter your administrator credentials to access the orchestration control plane.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="username">
                    Admin Username
                  </label>
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
                    <label className="text-xs font-medium text-foreground" htmlFor="password">
                      Admin Password
                    </label>
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
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  <span>AES-256-GCM Vault</span>
                </span>
                <span className="font-mono">Render Ready</span>
              </div>
            </form>

            {/* Right Branding Showcase Column */}
            <div className="relative hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white border-l border-border/40 overflow-hidden">
              <div className="relative z-10 flex flex-col gap-4">
                <div className="inline-flex items-center gap-2">
                  <Badge variant="outline" className="border-white/20 text-white/90 text-[11px] bg-white/5">
                    Unified Multi-Provider
                  </Badge>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[11px] bg-emerald-500/10">
                    Zero-DB Latency
                  </Badge>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-zinc-100">
                  Self-Hosted OpenAI SDK Gateway
                </h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Route completions, real-time audio, and custom OpenAI-compatible endpoints with zero proxy overhead.
                </p>
              </div>

              {/* Feature Highlights Grid */}
              <div className="relative z-10 grid grid-cols-2 gap-3 py-6">
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                    <Zap className="size-3.5 text-amber-400" />
                    <span>In-Memory Routing</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Synchronized hot-path without DB queries</p>
                </div>

                <div className="flex flex-col gap-1 p-3 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                    <Activity className="size-3.5 text-sky-400" />
                    <span>SSE Streaming</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Zero-copy chunk piping with TTFT metrics</p>
                </div>

                <div className="flex flex-col gap-1 p-3 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                    <ShieldCheck className="size-3.5 text-emerald-400" />
                    <span>Neon Postgres</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Encrypted state for ephemeral containers</p>
                </div>

                <div className="flex flex-col gap-1 p-3 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                    <Cpu className="size-3.5 text-purple-400" />
                    <span>Custom Providers</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">DeepSeek, Together, Ollama instantly</p>
                </div>
              </div>

              <div className="relative z-10 text-[11px] text-zinc-500 font-mono">
                OpenAI SDK Compatible API · /v1/chat/completions · /v1/models
              </div>

              {/* Ambient Glow Graphic */}
              <div className="absolute -right-20 -bottom-20 size-80 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
