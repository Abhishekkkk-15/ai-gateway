// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext.js';
import { ThemeToggle } from '../src/components/ThemeToggle.js';

function TestConsumer() {
  const { theme, isDark } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="is-dark">{String(isDark)}</span>
      <ThemeToggle />
    </div>
  );
}

describe('ThemeContext & ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('initializes with default dark theme and adds dark class to documentElement', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(screen.getByTestId('is-dark').textContent).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists an explicit theme selection and applies the class', () => {
    function Switcher() {
      const { setTheme } = useTheme();
      return (
        <button type="button" onClick={() => setTheme('light')}>
          go light
        </button>
      );
    }

    render(
      <ThemeProvider defaultTheme="dark">
        <Switcher />
        <TestConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /go light/i }));

    expect(screen.getByTestId('current-theme').textContent).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(localStorage.getItem('ai-gateway-theme')).toBe('light');
  });
});
