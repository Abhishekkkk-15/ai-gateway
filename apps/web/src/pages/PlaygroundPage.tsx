import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';
import { Play, Mic, Volume2, Timer, Zap, Send, RotateCcw, AlertCircle } from 'lucide-react';

export function PlaygroundPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'tts' | 'stt'>('chat');
  const [gatewayKey, setGatewayKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');

  // Chat state
  const [prompt, setPrompt] = useState('Explain the benefits of an in-memory routing cache in 3 concise bullet points.');
  const [chatOutput, setChatOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [ttftMs, setTtftMs] = useState<number | null>(null);
  const [totalLatencyMs, setTotalLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // TTS state
  const [ttsText, setTtsText] = useState('Welcome to the high-performance AI API Gateway.');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // STT state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [sttText, setSttText] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Fetch available models and keys to pre-fill
  const { data: modelsData } = useQuery({ queryKey: ['models'], queryFn: () => api.getModels() });
  const { data: keysData } = useQuery({ queryKey: ['gateway-keys'], queryFn: () => api.getGatewayKeys() });

  const models = modelsData?.models || [];
  const keys = keysData?.keys || [];

  const handleSendChat = async () => {
    if (!prompt.trim()) return;
    setError(null);
    setChatOutput('');
    setTtftMs(null);
    setTotalLatencyMs(null);
    setIsStreaming(true);

    const modelToUse = selectedModel || (models.length > 0 ? models[0].customAlias || models[0].slug : 'groq/llama-3.3-70b-versatile');
    const keyToUse = gatewayKey || 'sk-gw-test-key';

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interactive Playground</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test and benchmark streaming Chat Completions, Text-to-Speech, and Audio Transcriptions with real-time TTFT metrics.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex space-x-1 bg-muted p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'chat' ? 'bg-background text-foreground shadow' : 'text-muted-foreground'
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            <span>Chat Completions</span>
          </button>
          <button
            onClick={() => setActiveTab('tts')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'tts' ? 'bg-background text-foreground shadow' : 'text-muted-foreground'
            }`}
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>Text-to-Speech</span>
          </button>
          <button
            onClick={() => setActiveTab('stt')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'stt' ? 'bg-background text-foreground shadow' : 'text-muted-foreground'
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            <span>Speech-to-Text</span>
          </button>
        </div>
      </div>

      {/* Credentials and Target Configuration Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-card/60 border border-border/80 p-4 rounded-xl">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Gateway API Key</label>
          <Input
            type="password"
            placeholder={keys.length > 0 ? `Select or enter key (${keys[0].prefix}...)` : 'sk-gw-...'}
            value={gatewayKey}
            onChange={(e) => setGatewayKey(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Select Model or Routable Alias</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-xs shadow-sm font-mono text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Default (Auto-select first enabled model)</option>
            {models.map((m) => (
              <option key={m.slug} value={m.customAlias || m.slug}>
                {m.customAlias ? `${m.customAlias} (${m.slug})` : m.slug}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2 text-sm text-red-400 bg-red-950/20 border border-red-900/40 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* CHAT TAB */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/80 flex flex-col justify-between">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prompt Input</CardTitle>
              <CardDescription>Enter test instructions for streaming inference</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                className="w-full rounded-md border border-input bg-background/50 p-3 text-sm font-sans focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Type your prompt here..."
              />
              <Button onClick={handleSendChat} disabled={isStreaming} className="w-full flex items-center space-x-2">
                <Send className="h-4 w-4" />
                <span>{isStreaming ? 'Streaming Response...' : 'Send Completion Request'}</span>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80 flex flex-col justify-between">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Streaming Output &amp; Telemetry</CardTitle>
                <CardDescription>Live tokens piped over SSE</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                {ttftMs !== null && (
                  <Badge variant="default" className="flex items-center space-x-1 text-xs font-mono">
                    <Zap className="h-3 w-3 text-amber-400" />
                    <span>TTFT: {ttftMs}ms</span>
                  </Badge>
                )}
                {totalLatencyMs !== null && (
                  <Badge variant="secondary" className="flex items-center space-x-1 text-xs font-mono">
                    <Timer className="h-3 w-3 text-primary" />
                    <span>Total: {totalLatencyMs}ms</span>
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="rounded-md border border-border bg-black/40 p-4 min-h-[220px] max-h-[360px] overflow-y-auto text-sm font-mono whitespace-pre-wrap leading-relaxed">
                {chatOutput ? (
                  chatOutput
                ) : (
                  <span className="text-muted-foreground italic">Response chunks will stream here in real-time...</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TTS TAB */}
      {activeTab === 'tts' && (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base">Text-to-Speech Synthesis</CardTitle>
            <CardDescription>Converts text to streaming audio binary (ElevenLabs adapter)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background/50 p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button onClick={handleSynthesizeTts} disabled={isSynthesizing} className="flex items-center space-x-2">
              <Volume2 className="h-4 w-4" />
              <span>{isSynthesizing ? 'Synthesizing...' : 'Synthesize Audio'}</span>
            </Button>

            {audioUrl && (
              <div className="pt-4 border-t border-border/50">
                <audio controls src={audioUrl} className="w-full" autoPlay />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STT TAB */}
      {activeTab === 'stt' && (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base">Speech-to-Text Transcription</CardTitle>
            <CardDescription>Upload an audio file (mp3, wav, m4a) to transcribe via Whisper or Scribe</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
            <Button
              onClick={handleTranscribeStt}
              disabled={!audioFile || isTranscribing}
              className="flex items-center space-x-2"
            >
              <Mic className="h-4 w-4" />
              <span>{isTranscribing ? 'Transcribing...' : 'Transcribe Audio'}</span>
            </Button>

            {sttText && (
              <div className="p-4 rounded-lg bg-black/40 border border-border mt-4">
                <span className="text-xs text-muted-foreground block mb-1">Transcription Result:</span>
                <p className="text-sm font-sans">{sttText}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
