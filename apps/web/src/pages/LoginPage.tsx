import React from 'react';
import { Shield } from 'lucide-react';
import { LoginForm } from '../components/login-form.js';
import { DeveloperIllustration } from '../components/DeveloperIllustration.js';
import { ThemeToggle } from '../components/ThemeToggle.js';

export interface LoginPageProps {
  onLoginSuccess: (user: { username: string }) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Form column (shadcn login-02 structure) */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Shield className="size-4" />
            </div>
            <span>AI Gateway</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm onLoginSuccess={onLoginSuccess} />
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground font-mono">
          Self-Hosted OpenAI SDK Gateway
        </div>
      </div>

      {/* Visual column: Clean developer illustration (shadcn login-02 right side) */}
      <div className="relative hidden bg-muted/50 lg:flex items-center justify-center p-10 border-l border-border/40 overflow-hidden">
        <div className="w-full max-w-md">
          <DeveloperIllustration />
        </div>
      </div>
    </div>
  );
}
