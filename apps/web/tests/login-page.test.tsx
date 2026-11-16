import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPage } from '../src/pages/LoginPage.js';
import { api } from '../src/lib/api.js';
import { ThemeProvider } from '../src/context/ThemeContext.js';

vi.mock('../src/lib/api.js', () => ({
  api: {
    login: vi.fn(),
  },
}));

describe('LoginPage (login-04)', () => {
  it('renders split login form with branding', () => {
    render(
      <ThemeProvider>
        <LoginPage onLoginSuccess={vi.fn()} />
      </ThemeProvider>
    );

    expect(screen.getByText('Welcome back')).toBeDefined();
    expect(screen.getByLabelText(/admin username/i)).toBeDefined();
    expect(screen.getByLabelText(/admin password/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /sign in to console/i })).toBeDefined();
    expect(screen.getByText(/Self-Hosted OpenAI SDK Gateway/i)).toBeDefined();
  });

  it('calls api.login and onLoginSuccess on valid submit', async () => {
    const onLoginSuccess = vi.fn();
    (api.login as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { username: 'admin' },
    });

    render(
      <ThemeProvider>
        <LoginPage onLoginSuccess={onLoginSuccess} />
      </ThemeProvider>
    );

    const passwordInput = screen.getByLabelText(/admin password/i);
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitBtn = screen.getByRole('button', { name: /sign in to console/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('admin', 'password123');
      expect(onLoginSuccess).toHaveBeenCalledWith({ username: 'admin' });
    });
  });

  it('displays error banner when authentication fails', async () => {
    (api.login as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Invalid admin credentials')
    );

    render(
      <ThemeProvider>
        <LoginPage onLoginSuccess={vi.fn()} />
      </ThemeProvider>
    );

    const submitBtn = screen.getByRole('button', { name: /sign in to console/i });
    const form = submitBtn.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Invalid admin credentials')).toBeDefined();
    });
  });
});
