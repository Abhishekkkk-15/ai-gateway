import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';
import {
  Play,
  Mic,
  Volume2,
  Timer,
  Zap,
  Send,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Bot,
  Copy,
  Check,
} from 'lucide-react';

const PROMPT_SUGGESTIONS = [
  'Explain the benefits of an in-memory routing cache in 3 concise bullet points.',
  'Write a TypeScript function to calculate Exponential Moving Average (EMA).',
  'What are the core differences between SSE streaming and WebSockets for LLMs?',
];

export function PlaygroundPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'tts' | 'stt'>('chat');
  const [gatewayKey, setGatewayKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');

  // Chat state
  const [prompt, setPrompt] = useState(
    'Explain the benefits of an in-memory routing cache in 3 concise bullet points.'
  );
  const [chatOutput, setChatOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [ttftMs, setTtftMs] = useState<number | null>(null);
  const [totalLatencyMs, setTotalLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // TTS state
  const [ttsText, setTtsText] = useState('Welcome to the high-performance AI API Gateway.');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // STT state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [sttText, setSttText] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Fetch available models and keys to pre-fill
  const { data: modelsData } = useQuery({
    queryKey: ['models'],
    queryFn: () => api.getModels(),
  });
  const { data: keysData } = useQuery({
    queryKey: ['gateway-keys'],
    queryFn: () => api.getGatewayKeys(),
  });

  const models = modelsData?.models || [];
  const keys = keysData?.keys || [];

  const handleSendChat = async () => {
    if (!prompt.trim()) return;
    setError(null);
    setChatOutput('');
    setTtftMs(null);
    setTotalLatencyMs(null);
    setIsStreaming(true);

    const modelToUse =
      selectedModel ||
      (models.length > 0 ? models[0].customAlias || models[0].slug : 'groq/llama-3.3-70b-versatile');
    const keyToUse = gatewayKey || (keys.length > 0 ? keys[0].id : 'sk-gw-test-key');

    try {
      const result = await api.chatStream(
        keyToUse,
        modelToUse,
        prompt,
        (chunk) => {
          setChatOutput((prev) => prev + chunk);
        },
        (ttft) => {
          setTtftMs(ttft);
        }
      );
      setTotalLatencyMs(result.totalTimeMs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chat request failed');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleCopyChat = () => {
    if (!chatOutput) return;
    navigator.clipboard.writeText(chatOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSynthesizeTts = async () => {
    if (!ttsText.trim()) return;
    setError(null);
    setIsSynthesizing(true);
    setAudioUrl(null);

    const keyToUse = gatewayKey || 'sk-gw-test-key';

    try {
      const res = await fetch('/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keyToUse}`,
        },
        body: JSON.stringify({
          model: 'eleven_flash_v2_5',
          input: ttsText,
          voice: '21m00Tcm4TlvDq8ikWAM',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `TTS failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Speech synthesis failed');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleTranscribeStt = async () => {
    if (!audioFile) return;
    setError(null);
    setIsTranscribing(true);
    setSttText(null);

    const keyToUse = gatewayKey || 'sk-gw-test-key';
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-large-v3-turbo');

    try {
      const res = await fetch('/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${keyToUse}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `STT failed with status ${res.status}`);
      }

      const data = await res.json();
      setSttText(data.text);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* Header and Mode Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Interactive Playground</h1>
            <Badge variant="outline" className="gap-1 text-[11px] font-mono">
              <Sparkles className="size-3 text-primary" />
              Live Inference
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Test and benchmark streaming Chat Completions, Text-to-Speech, and Audio Transcriptions with real-time TTFT metrics.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 bg-muted/80 p-1 rounded-lg border border-border/60 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Play className="size-3.5" />
            <span>Chat</span>
          </button>
          <button
            onClick={() => setActiveTab('tts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'tts'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Volume2 className="size-3.5" />
            <span>TTS</span>
          </button>
          <button
            onClick={() => setActiveTab('stt')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'stt'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mic className="size-3.5" />
            <span>STT</span>
          </button>
        </div>
      </div>

      {/* Target Configuration Bar */}
      <Card className="border-border/80 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Gateway API Key</label>
              <Input
                type="password"
                placeholder={keys.length > 0 ? `Auto: ${keys[0].prefix}...` : 'sk-gw-...'}
                value={gatewayKey}
                onChange={(e) => setGatewayKey(e.target.value)}
                className="font-mono text-xs bg-background/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Select Model or Routable Alias</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-xs shadow-sm font-mono text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Default (Auto-select first enabled model)</option>
                {models
                  .filter((m) => m.isEnabled)
                  .map((m) => (
                    <option key={m.slug} value={m.customAlias || m.slug}>
                      {m.customAlias ? `${m.customAlias} (${m.slug})` : m.slug}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2.5 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* CHAT TAB */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/80 flex flex-col justify-between shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="size-4 text-primary" />
                Prompt Input
              </CardTitle>
              <CardDescription>Enter test instructions for streaming inference</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 flex-1">
              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(suggestion)}
                    className="text-[11px] bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md transition-colors text-left truncate max-w-full border border-border/40"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                className="w-full rounded-md border border-input bg-background/50 p-3 text-sm font-sans focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none leading-relaxed flex-1"
                placeholder="Type your prompt here..."
              />

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSendChat}
                  disabled={isStreaming}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <Send className="size-4" />
                  <span>{isStreaming ? 'Streaming Response...' : 'Send Completion Request'}</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPrompt('');
                    setChatOutput('');
                    setTtftMs(null);
                    setTotalLatencyMs(null);
                  }}
                  title="Clear prompt and output"
                  className="size-9 p-0 shrink-0"
                >
                  <RotateCcw className="size-4 text-muted-foreground" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 flex flex-col justify-between shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Streaming Output &amp; Telemetry</CardTitle>
                <CardDescription>Live tokens piped over SSE</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {ttftMs !== null && (
                  <Badge variant="outline" className="flex items-center gap-1 text-xs font-mono border-amber-500/30 text-amber-500 bg-amber-500/10">
                    <Zap className="size-3" />
                    <span>TTFT: {ttftMs}ms</span>
                  </Badge>
                )}
                {totalLatencyMs !== null && (
                  <Badge variant="outline" className="flex items-center gap-1 text-xs font-mono border-primary/30 text-primary bg-primary/10">
                    <Timer className="size-3" />
                    <span>Total: {totalLatencyMs}ms</span>
                  </Badge>
                )}
                {chatOutput && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyChat}
                    className="size-7 p-0"
                    title="Copy output"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-muted-foreground" />}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="rounded-md border border-border/80 bg-zinc-950/70 dark:bg-black/80 p-4 min-h-[260px] max-h-[380px] overflow-y-auto text-xs font-mono text-zinc-100 whitespace-pre-wrap leading-relaxed shadow-inner flex-1">
                {chatOutput ? (
                  chatOutput
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic gap-2 py-12">
                    <Sparkles className="size-6 text-muted-foreground/40" />
                    <span>Response tokens will stream here in real-time...</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TTS TAB */}
      {activeTab === 'tts' && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Volume2 className="size-4 text-primary" />
              Text-to-Speech Synthesis
            </CardTitle>
            <CardDescription>Converts text to streaming audio binary (ElevenLabs adapter)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <textarea
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background/50 p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring leading-relaxed"
            />
            <Button
              onClick={handleSynthesizeTts}
              disabled={isSynthesizing}
              className="flex items-center gap-2 self-start"
            >
              <Volume2 className="size-4" />
              <span>{isSynthesizing ? 'Synthesizing...' : 'Synthesize Audio'}</span>
            </Button>

            {audioUrl && (
              <div className="pt-4 border-t border-border/50">
                <audio controls src={audioUrl} className="w-full rounded-lg" autoPlay />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STT TAB */}
      {activeTab === 'stt' && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="size-4 text-primary" />
              Speech-to-Text Transcription
            </CardTitle>
            <CardDescription>Upload an audio file (mp3, wav, m4a) to transcribe via Whisper or Scribe</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
            <Button
              onClick={handleTranscribeStt}
              disabled={!audioFile || isTranscribing}
              className="flex items-center gap-2 self-start"
            >
              <Mic className="size-4" />
              <span>{isTranscribing ? 'Transcribing...' : 'Transcribe Audio'}</span>
            </Button>

            {sttText && (
              <div className="p-4 rounded-lg bg-black/40 border border-border/80 flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-semibold">Transcription Result:</span>
                <p className="text-sm font-sans leading-relaxed">{sttText}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
