import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';

export interface LoginFormProps extends React.ComponentPropsWithoutRef<'div'> {
  onLoginSuccess: (user: { username: string }) => void;
}

export function LoginForm({ className, onLoginSuccess, ...props }: LoginFormProps) {
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
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2 font-medium">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Shield className="size-5" />
              </div>
              <span className="text-base font-semibold tracking-tight">AI Gateway</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-xs text-muted-foreground">
              Enter your administrator credentials to access the console
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label className="text-xs font-medium" htmlFor="username">
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

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium" htmlFor="password">
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
        </div>
      </form>

      <div className="text-balance text-center text-xs text-muted-foreground font-mono">
        Self-Hosted OpenAI SDK Gateway · v1.0.0
      </div>
    </div>
  );
}
