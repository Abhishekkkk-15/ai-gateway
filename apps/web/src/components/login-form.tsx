import React, { useState } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
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
    <div className={cn('flex flex-col gap-4', className)} {...props}>
      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader className="items-center gap-4 text-center">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Shield className="size-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">AI Gateway</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Enter your administrator credentials to access the console
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-5">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Field className="gap-1.5" data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="username">Admin Username</FieldLabel>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </Field>

              <Field className="gap-1.5">
                <FieldLabel htmlFor="password">Admin Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  disabled={isLoading}
                />
              </Field>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Spinner />
                    Signing in...
                  </>
                ) : (
                  'Sign in to Console'
                )}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t border-border pt-4">
          <p className="text-center text-xs text-muted-foreground">
            Self-Hosted OpenAI SDK Gateway · v1.0.0
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
