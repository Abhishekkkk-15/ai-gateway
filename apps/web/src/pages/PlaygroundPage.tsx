import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Badge } from '../components/ui/badge.js';
import { Avatar, AvatarFallback } from '../components/ui/avatar.js';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from '../components/ui/select.js';
import {
  Play,
  Mic,
  Volume2,
  Timer,
  Zap,
  Send,
  RotateCcw,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  Brain,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
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

  // Chat conversation state
  const [prompt, setPrompt] = useState(
    'Explain the benefits of an in-memory routing cache in 3 concise bullet points.'
  );
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [assistantOutput, setAssistantOutput] = useState('');
  const [reasoningOutput, setReasoningOutput] = useState('');
  const [isReasoningOpen, setIsReasoningOpen] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [ttftMs, setTtftMs] = useState<number | null>(null);
  const [totalLatencyMs, setTotalLatencyMs] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

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
  const enabledModels = models.filter((m) => m.isEnabled);

  // Auto-scroll chat as tokens stream in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [assistantOutput, reasoningOutput]);

  const handleSendChat = async () => {
    if (!prompt.trim() || isStreaming) return;
    const currentPrompt = prompt.trim();
    setUserMessage(currentPrompt);
    setAssistantOutput('');
    setReasoningOutput('');
    setTtftMs(null);
    setTotalLatencyMs(null);
    setIsStreaming(true);

    const modelToUse =
      selectedModel ||
      (enabledModels.length > 0
        ? enabledModels[0].customAlias || enabledModels[0].slug
        : 'groq/llama-3.3-70b-versatile');
    const keyToUse = gatewayKey || (keys.length > 0 ? keys[0].id : 'sk-gw-test-key');

    try {
      const result = await api.chatStream(
        keyToUse,
        modelToUse,
        currentPrompt,
        (chunk) => {
          setAssistantOutput((prev) => prev + chunk);
        },
        (ttft) => {
          setTtftMs(ttft);
        }
      );
      setTotalLatencyMs(result.totalTimeMs);
      toast.success(`Completed in ${result.totalTimeMs}ms (TTFT: ${ttftMs || 0}ms)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Chat request failed';
      toast.error(msg);
      setAssistantOutput((prev) => prev + `\n\n[Error: ${msg}]`);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleCopyChat = () => {
    if (!assistantOutput) return;
    navigator.clipboard.writeText(assistantOutput);
    setCopied(true);
    toast.success('Response copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendChat();
    }
  };

  const handleResetChat = () => {
    setUserMessage(null);
    setAssistantOutput('');
    setReasoningOutput('');
    setTtftMs(null);
    setTotalLatencyMs(null);
  };

  const handleSynthesizeTts = async () => {
    if (!ttsText.trim()) return;
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
      toast.success('Audio synthesized successfully!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Speech synthesis failed');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleTranscribeStt = async () => {
    if (!audioFile) return;
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
      toast.success('Audio transcribed successfully!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Transcription failed');
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
            Benchmark streaming Chat Completions, Text-to-Speech, and Audio Transcriptions with real-time TTFT metrics.
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
                className="font-mono text-xs bg-background/50 h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Select Model or Routable Alias</label>
              <Select
                value={selectedModel}
                onValueChange={(val) => setSelectedModel(val)}
              >
                <SelectTrigger className="h-9 font-mono text-xs bg-background/50">
                  <SelectValue placeholder="Auto-select first enabled model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-xs font-sans">Available Models ({enabledModels.length})</SelectLabel>
                    {enabledModels.map((m) => (
                      <SelectItem
                        key={m.slug}
                        value={m.customAlias || m.slug}
                        className="font-mono text-xs"
                      >
                        {m.customAlias ? `${m.customAlias} (${m.slug})` : m.slug}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CHAT TAB - AI CONVERSATIONAL THREAD */}
      {activeTab === 'chat' && (
        <div className="flex flex-col gap-4">
          {/* Chat Transcript Container */}
          <Card className="border-border/80 shadow-sm flex flex-col h-[520px]">
            <CardHeader className="py-3 px-4 border-b border-border/60 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Inference Stream</CardTitle>
                <span className="text-xs text-muted-foreground font-mono">
                  {selectedModel || (enabledModels[0]?.customAlias || enabledModels[0]?.slug || 'auto')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {ttftMs !== null && (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 text-[11px] font-mono border-amber-500/30 text-amber-500 bg-amber-500/10"
                  >
                    <Zap className="size-3" />
                    <span>TTFT: {ttftMs}ms</span>
                  </Badge>
                )}
                {totalLatencyMs !== null && (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 text-[11px] font-mono border-primary/30 text-primary bg-primary/10"
                  >
                    <Timer className="size-3" />
                    <span>Total: {totalLatencyMs}ms</span>
                  </Badge>
                )}
                {assistantOutput && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyChat}
                    className="size-7 p-0"
                    title="Copy output"
                  >
                    {copied ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5 text-muted-foreground" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetChat}
                  className="size-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Clear chat"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 bg-background/40"
            >
              {/* Initial Assistant Greeting */}
              <div className="flex items-start gap-3 max-w-[85%]">
                <Avatar className="size-7 rounded-lg border border-border shrink-0 mt-0.5">
                  <AvatarFallback className="bg-primary/20 text-primary text-[11px] font-bold">
                    AI
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                  <div className="rounded-2xl rounded-tl-sm bg-muted/60 border border-border/60 px-4 py-2.5 text-xs text-foreground leading-relaxed shadow-sm">
                    Ready for inference. Select a prompt template below or type your own instructions to stream tokens over SSE with sub-millisecond routing.
                  </div>
                </div>
              </div>

              {/* User Message Turn */}
              {userMessage && (
                <div className="flex items-start justify-end gap-3 max-w-[85%] self-end">
                  <div className="flex flex-col gap-1 items-end">
                    <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-xs leading-relaxed shadow-sm">
                      {userMessage}
                    </div>
                  </div>
                  <Avatar className="size-7 rounded-lg border border-primary/30 shrink-0 mt-0.5">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                      U
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}

              {/* Assistant Response Turn */}
              {(isStreaming || assistantOutput || reasoningOutput) && (
                <div className="flex items-start gap-3 max-w-[90%]">
                  <Avatar className="size-7 rounded-lg border border-border shrink-0 mt-0.5">
                    <AvatarFallback className="bg-primary/20 text-primary text-[11px] font-bold">
                      AI
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    {/* Collapsible Chain-of-Thought / Reasoning Element */}
                    {reasoningOutput && (
                      <div className="rounded-lg border border-border/80 bg-zinc-950/40 p-2.5 text-xs font-mono">
                        <button
                          type="button"
                          onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-semibold w-full text-left"
                        >
                          <Brain className="size-3.5 text-primary" />
                          <span>Thought process</span>
                          {isReasoningOpen ? (
                            <ChevronDown className="size-3 ml-auto" />
                          ) : (
                            <ChevronRight className="size-3 ml-auto" />
                          )}
                        </button>
                        {isReasoningOpen && (
                          <div className="mt-2 text-zinc-400 whitespace-pre-wrap leading-relaxed text-[11px] border-t border-border/40 pt-2 max-h-48 overflow-y-auto">
                            {reasoningOutput}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stream Content Bubble */}
                    <div className="rounded-2xl rounded-tl-sm bg-muted/60 border border-border/60 px-4 py-3 text-xs text-foreground leading-relaxed shadow-sm font-sans whitespace-pre-wrap">
                      {assistantOutput ? (
                        <>
                          {assistantOutput}
                          {isStreaming && (
                            <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-primary animate-pulse align-middle" />
                          )}
                        </>
                      ) : isStreaming ? (
                        <div className="flex items-center gap-2 text-muted-foreground italic">
                          <Loader2 className="size-3.5 animate-spin text-primary" />
                          <span>Generating tokens...</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Prompt Suggestions */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Sparkles className="size-3" />
              Templates:
            </span>
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

          {/* Prompt Input Box */}
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-3">
              <div className="flex flex-col gap-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                  className="w-full rounded-md border-0 bg-transparent p-1 text-sm font-sans focus-visible:outline-none resize-none leading-relaxed"
                  placeholder="Ask a question or provide instructions (Press Enter to send, Shift+Enter for newline)..."
                />

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <span className="text-[11px] text-muted-foreground">
                    Shift + Enter for new lines
                  </span>
                  <Button
                    onClick={handleSendChat}
                    disabled={isStreaming || !prompt.trim()}
                    className="flex items-center gap-1.5 h-8 px-3 text-xs shadow-sm"
                  >
                    {isStreaming ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Streaming...</span>
                      </>
                    ) : (
                      <>
                        <Send className="size-3.5" />
                        <span>Send Prompt</span>
                      </>
                    )}
                  </Button>
                </div>
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
              {isSynthesizing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Volume2 className="size-4" />
                  <span>Synthesize Audio</span>
                </>
              )}
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
              {isTranscribing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Transcribing...</span>
                </>
              ) : (
                <>
                  <Mic className="size-4" />
                  <span>Transcribe Audio</span>
                </>
              )}
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
