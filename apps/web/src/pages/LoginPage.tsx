import React from 'react';
import { LoginForm } from '../components/login-form.js';
import { ThemeToggle } from '../components/ThemeToggle.js';

export interface LoginPageProps {
  onLoginSuccess: (user: { username: string }) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-background">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <LoginForm onLoginSuccess={onLoginSuccess} />
      </div>
    </div>
  );
}
