// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/context/ThemeContext.js';
import { LoginPage } from '../src/pages/LoginPage.js';

describe('Admin Web Dashboard', () => {
  const queryClient = new QueryClient();

  it('renders login page with username and password inputs inside ThemeProvider', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LoginPage onLoginSuccess={() => {}} />
        </ThemeProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('AI Gateway')).toBeDefined();
    expect(screen.getByPlaceholderText('admin')).toBeDefined();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeDefined();
    expect(screen.getByRole('button', { name: /sign in to console/i })).toBeDefined();
  });
});
