// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlaygroundPage } from '../src/pages/PlaygroundPage.js';
import { LogsPage } from '../src/pages/LogsPage.js';
import { ModelsPage } from '../src/pages/ModelsPage.js';
import { ThemeProvider } from '../src/context/ThemeContext.js';

vi.mock('../src/lib/api.js', () => ({
  api: {
    getModels: vi.fn().mockResolvedValue({
      models: [
        {
          slug: 'groq/llama-3.3-70b-versatile',
          modelId: 'llama-3.3-70b-versatile',
          providerId: 'groq',
          displayName: 'Llama 3.3 70B',
          capabilities: ['chat', 'tools'],
          contextWindow: 131072,
          customAlias: 'groq-llama',
          isEnabled: true,
        },
        {
          slug: 'nvidia/deepseek-ai/deepseek-v4.1-flash',
          modelId: 'deepseek-v4.1-flash',
          providerId: 'nvidia',
          displayName: 'DeepSeek Flash',
          capabilities: ['chat'],
          contextWindow: 65536,
          customAlias: null,
          isEnabled: false,
        },
      ],
    }),
    updateModel: vi.fn().mockResolvedValue({ message: 'Model updated' }),
    createModel: vi.fn().mockResolvedValue({
      message: 'Model added to catalog.',
      model: {
        slug: 'google/gemini-2.5-pro',
        modelId: 'gemini-2.5-pro',
        providerId: 'google',
        displayName: 'Gemini 2.5 Pro',
        capabilities: ['chat', 'vision', 'tools'],
        contextWindow: 2097152,
        customAlias: null,
        isEnabled: true,
      },
    }),
    getProviders: vi.fn().mockResolvedValue({
      providers: [
        { id: 'groq', name: 'Groq Cloud', isEnabled: true, isConfigured: true },
        { id: 'google', name: 'Google AI Studio', isEnabled: true, isConfigured: true },
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

describe('Feature Pages (Playground, Logs & Models)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders PlaygroundPage with chat tab by default and switches tabs', async () => {
    renderWithProviders(<PlaygroundPage />);

    expect(screen.getByText('Interactive Playground')).toBeDefined();
    expect(screen.getByText('Inference Stream')).toBeDefined();
    expect(screen.getByText('Send Prompt')).toBeDefined();

    // Custom model selection
    const modelTrigger = screen.getByRole('combobox', { name: /select model or routable alias/i });
    fireEvent.mouseDown(modelTrigger);
    fireEvent.click(await screen.findByText(/custom model \/ slug/i));
    expect(
      screen.getByPlaceholderText('e.g. cloudflare/@cf/meta/llama-3.1-8b-instruct')
    ).toBeDefined();

    // Switch to Image generation & vision
    const imageButton = screen.getByRole('tab', { name: /image/i });
    fireEvent.click(imageButton);
    expect(screen.getByText('Image Generation & Vision')).toBeDefined();
    expect(screen.getByText('Generate Image')).toBeDefined();
    expect(screen.getByText('No images yet')).toBeDefined();

    fireEvent.click(screen.getByText('Analyze'));
    expect(screen.getByText('Analyze Image')).toBeDefined();
    expect(screen.getByText('Drop an image here or click to browse')).toBeDefined();
    expect(screen.getByText('Nothing analyzed yet')).toBeDefined();

    // Switch to TTS
    const ttsButton = screen.getByRole('tab', { name: /tts/i });
    fireEvent.click(ttsButton);
    expect(screen.getByText('Text-to-Speech Synthesis')).toBeDefined();
    expect(screen.getByText('Voice Preset / ID')).toBeDefined();
    expect(screen.getByText('TTS Synthesis Model')).toBeDefined();
    expect(screen.getByText('Synthesize Audio')).toBeDefined();

    // Test TTS Stream-Input Mode Toggle
    const ttsStreamBtn = screen.getByText('Stream-Input (WS)');
    fireEvent.click(ttsStreamBtn);
    expect(screen.getByText('Stream Text Chunks')).toBeDefined();
    expect(screen.getByText('Time to First Audio (TTFA)')).toBeDefined();

    // Switch to STT
    const sttButton = screen.getByRole('tab', { name: /stt/i });
    fireEvent.click(sttButton);
    expect(screen.getByText('Speech-to-Text Transcription')).toBeDefined();

    // Test STT Realtime Stream Mode Toggle
    const sttStreamBtn = screen.getByText('Realtime Stream (WS)');
    fireEvent.click(sttStreamBtn);
    expect(screen.getByText('Start Streaming Audio (Mic)')).toBeDefined();
  });

  it('renders LogsPage with telemetry headers and structured filters', async () => {
    renderWithProviders(<LogsPage />);

    expect(screen.getByText('Request Telemetry & Logs')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText(/All Providers/i)).toBeDefined();
      expect(screen.getByText(/All Models/i)).toBeDefined();
    });
    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('2xx Success')).toBeDefined();
    expect(screen.getByText('Errors')).toBeDefined();
  });

  it('renders ModelsPage with search input, filters toolbar, and models list', async () => {
    renderWithProviders(<ModelsPage />);

    expect(screen.getByText('Models Catalog')).toBeDefined();
    expect(
      screen.getByPlaceholderText('Search by slug, alias, provider...')
    ).toBeDefined();
    expect(screen.getByText(/All Providers/i)).toBeDefined();
    expect(screen.getByText('All Capabilities')).toBeDefined();
    expect(screen.getByText('Sort: Slug (A-Z)')).toBeDefined();

    // Wait for mock models to load
    await waitFor(() => {
      expect(screen.getByText('groq/llama-3.3-70b-versatile')).toBeDefined();
      expect(screen.getByText('nvidia/deepseek-ai/deepseek-v4.1-flash')).toBeDefined();
    });

    // Test filter by search
    const searchInput = screen.getByPlaceholderText('Search by slug, alias, provider...');
    fireEvent.change(searchInput, { target: { value: 'llama' } });

    expect(screen.getByText('groq/llama-3.3-70b-versatile')).toBeDefined();
    expect(screen.queryByText('nvidia/deepseek-ai/deepseek-v4.1-flash')).toBeNull();

    // Test opening Add Model dialog
    const addModelBtn = screen.getByRole('button', { name: /add model/i });
    fireEvent.click(addModelBtn);

    expect(screen.getByText('Add Model to Catalog')).toBeDefined();
    expect(screen.getByText(/Upstream Provider/i)).toBeDefined();
    expect(screen.getByText(/Upstream Model ID/i)).toBeDefined();
    expect(screen.getAllByText(/Capabilities/i).length).toBeGreaterThanOrEqual(1);

    // Verify Upstream Model ID and Display Name are plain text inputs
    const modelIdInput = screen.getByPlaceholderText(/llama-3.3-70b-versatile/i);
    expect(modelIdInput).toBeDefined();
    fireEvent.change(modelIdInput, { target: { value: 'custom-model-v1' } });
    expect((modelIdInput as HTMLInputElement).value).toBe('custom-model-v1');

    const displayNameInput = screen.getByPlaceholderText(/Llama 3.3 70B Versatile/i);
    expect(displayNameInput).toBeDefined();
    fireEvent.change(displayNameInput, { target: { value: 'Custom Model V1' } });
    expect((displayNameInput as HTMLInputElement).value).toBe('Custom Model V1');

    expect(screen.getByRole('button', { name: /register model/i })).toBeDefined();
  });
});
