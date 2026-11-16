// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '../src/pages/LoginPage.js';

describe('Admin Web Dashboard', () => {
  const queryClient = new QueryClient();

  it('renders login page with username and password inputs', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <LoginPage onLoginSuccess={() => {}} />
      </QueryClientProvider>
    );

    expect(screen.getByText('AI Gateway Console')).toBeDefined();
    expect(screen.getByPlaceholderText('Username')).toBeDefined();
    expect(screen.getByPlaceholderText('Password')).toBeDefined();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDefined();
  });
});
