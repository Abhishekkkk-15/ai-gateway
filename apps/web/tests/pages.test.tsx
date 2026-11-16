// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlaygroundPage } from '../src/pages/PlaygroundPage.js';
import { LogsPage } from '../src/pages/LogsPage.js';
import { ThemeProvider } from '../src/context/ThemeContext.js';

vi.mock('../src/lib/api.js', () => ({
  api: {
    getModels: vi.fn().mockResolvedValue({
      models: [
        {
          id: 'm-1',
          providerId: 'groq',
          slug: 'groq/llama-3.3-70b-versatile',
          customAlias: 'groq-llama',
          isEnabled: true,
        },
      ],
    }),
    getGatewayKeys: vi.fn().mockResolvedValue({
      keys: [{ id: 'k-1', name: 'Test Key', prefix: 'sk-gw-test', createdAt: '2026-11-16' }],
    }),
    getLogs: vi.fn().mockResolvedValue({
      logs: [
        {
          id: 'log-1',
          keyId: 'k-1',
          providerId: 'groq',
          modelSlug: 'groq/llama-3.3-70b-versatile',
          statusCode: 200,
          latencyMs: 142,
          ttftMs: 65,
          isStreaming: true,
          timestamp: '2026-11-16T12:00:00Z',
        },
      ],
    }),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">{ui}</ThemeProvider>
    </QueryClientProvider>
  );
}

describe('Feature Pages (Playground & Logs)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders PlaygroundPage with chat tab by default and switches tabs', async () => {
    renderWithProviders(<PlaygroundPage />);

    expect(screen.getByText('Interactive Playground')).toBeDefined();
    expect(screen.getByText('Inference Stream')).toBeDefined();
    expect(screen.getByText('Send Prompt')).toBeDefined();

    // Switch to TTS
    const ttsButton = screen.getByRole('button', { name: /tts/i });
    fireEvent.click(ttsButton);
    expect(screen.getByText('Text-to-Speech Synthesis')).toBeDefined();

    // Switch to STT
    const sttButton = screen.getByRole('button', { name: /stt/i });
    fireEvent.click(sttButton);
    expect(screen.getByText('Speech-to-Text Transcription')).toBeDefined();
  });

  it('renders LogsPage with telemetry headers and search filter', async () => {
    renderWithProviders(<LogsPage />);

    expect(screen.getByText('Request Telemetry & Logs')).toBeDefined();
    expect(
      screen.getByPlaceholderText('Filter by model slug or provider ID...')
    ).toBeDefined();
    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('2xx Success')).toBeDefined();
    expect(screen.getByText('Errors')).toBeDefined();
  });
});
