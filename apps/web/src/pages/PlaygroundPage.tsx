import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Textarea } from '../components/ui/textarea.js';
import { Badge } from '../components/ui/badge.js';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert.js';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/collapsible.js';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import { InlineCode } from '../components/ui/code-block.js';
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
  Bot,
  User,
  Copy,
  Check,
  Brain,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  AudioLines,
  Sliders,
  Radio,
  Square,
  FileAudio,
  Layers,
} from 'lucide-react';

const PROMPT_SUGGESTIONS = [
  'State your model name and capabilities.',
  'Write a Python snippet to call this gateway with the OpenAI SDK.',
  'Explain how Server-Sent Events work compared to standard HTTP chunking.',
];

const PRESET_VOICES = [
  {
    category: 'ElevenLabs Default Premade (Works on Free Plan)',
    voices: [
      { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Warm, British (Default Free)' },
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Calm, Professional (Default Free)' },
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Soft, Gentle, Friendly (Default Free)' },
      { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', description: 'Calm, Steady, Confident (Default Free)' },
      { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Young, Natural (Default Free)' },
      { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'Clear, Confident (Default Free)' },
      { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', description: 'Confident, Neutral (Default Free)' },
      { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Enthusiastic, Bright (Default Free)' },
      { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Australian, Casual (Default Free)' },
      { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Deep, News Broadcaster (Default Free)' },
      { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Velvety, Warm Narrator (Default Free)' },
      { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', description: 'Trustworthy, Documentary (Default Free)' },
      { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', description: 'Deep, Dynamic, Professional (Default Free)' },
    ],
  },
  {
    category: 'ElevenLabs Community Library (Paid Subscription Required)',
    voices: [
      { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Deep, Narrative [Paid Plan]' },
      { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Crisp, Professional [Paid Plan]' },
      { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Conversational [Paid Plan]' },
      { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', description: 'Dynamic, Versatile [Paid Plan]' },
      { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Authoritative, Strong [Paid Plan]' },
    ],
  },
  {
    category: 'OpenAI Standard Voices',
    voices: [
      { id: 'alloy', name: 'Alloy', description: 'Neutral, Balanced' },
      { id: 'echo', name: 'Echo', description: 'Warm, Well-rounded' },
      { id: 'fable', name: 'Fable', description: 'British Accent' },
      { id: 'onyx', name: 'Onyx', description: 'Deep, Resonant' },
      { id: 'nova', name: 'Nova', description: 'Energetic, Bright' },
      { id: 'shimmer', name: 'Shimmer', description: 'Clear, Expressive' },
    ],
  },
];

export function PlaygroundPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'tts' | 'stt'>('chat');
  const [gatewayKey, setGatewayKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');

  // Chat conversation state
  const [prompt, setPrompt] = useState(
    'State your model name and capabilities.'
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
  const [ttsText, setTtsText] = useState('Testing gateway audio synthesis.');
  const [ttsModel, setTtsModel] = useState('eleven_flash_v2_5');
  const [selectedVoice, setSelectedVoice] = useState('21m00Tcm4TlvDq8ikWAM');
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Decoupled TTS mode ('batch' HTTP synthesis vs 'stream-input' WebSocket chunks)
  const [ttsMode, setTtsMode] = useState<'batch' | 'stream-input'>('batch');
  const [isTtsStreaming, setIsTtsStreaming] = useState(false);
  const [ttsStreamInputTokens, setTtsStreamInputTokens] = useState(
    'Streaming text chunks through the gateway.'
  );
  const [ttsAudioChunksReceived, setTtsAudioChunksReceived] = useState(0);
  const [ttsFirstChunkLatencyMs, setTtsFirstChunkLatencyMs] = useState<number | null>(null);
  const ttsWsRef = useRef<WebSocket | null>(null);

  // STT state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [sttText, setSttText] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Decoupled STT mode ('batch' file upload vs 'realtime' streaming mic)
  const [sttMode, setSttMode] = useState<'batch' | 'realtime'>('batch');
  const [isSttStreaming, setIsSttStreaming] = useState(false);
  const [sttPartialTranscript, setSttPartialTranscript] = useState('');
  const [sttCommittedTranscripts, setSttCommittedTranscripts] = useState<string[]>([]);
  const sttWsRef = useRef<WebSocket | null>(null);
  const sttAudioCtxRef = useRef<AudioContext | null>(null);
  const sttMediaStreamRef = useRef<MediaStream | null>(null);
  const sttProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Fetch available models and keys to pre-fill
  const { data: modelsData } = useQuery({
    queryKey: ['models'],
    queryFn: () => api.getModels(),
  });
  const { data: keysData } = useQuery({
    queryKey: ['gateway-keys'],
    queryFn: () => api.getGatewayKeys(),
  });
  const { data: elevenLabsVoicesData, refetch: refetchVoices, isFetching: isFetchingVoices } = useQuery({
    queryKey: ['elevenlabs-voices'],
    queryFn: () => api.getElevenLabsVoices(),
    staleTime: 60000,
  });

  const models = modelsData?.models || [];
  const keys = keysData?.keys || [];
  const enabledModels = models.filter((m) => m.isEnabled);

  const liveVoices = elevenLabsVoicesData?.voices || [];

  const isSelectedVoiceLibrary = useMemo(() => {
    if (selectedVoice === 'custom') return false;
    const libraryGroup = PRESET_VOICES.find((g) => g.category.includes('Library'));
    if (libraryGroup?.voices.some((v) => v.id === selectedVoice)) return true;
    const live = liveVoices.find((v) => v.id === selectedVoice);
    return live ? !live.isFreeSupported : false;
  }, [selectedVoice, liveVoices]);

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

    const effectiveVoice = selectedVoice === 'custom' ? customVoiceId.trim() : selectedVoice;
    if (!effectiveVoice) {
      toast.error('Please enter a custom Voice ID or select a preset voice.');
      return;
    }

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
          model: ttsModel || 'eleven_flash_v2_5',
          input: ttsText,
          voice: effectiveVoice,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg =
          errJson.error?.message ||
          errJson.detail?.message ||
          errJson.message ||
          `TTS failed with status ${res.status}`;
        throw new Error(msg);
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

  const stopSttStream = () => {
    if (sttProcessorRef.current) {
      try {
        sttProcessorRef.current.disconnect();
      } catch {}
      sttProcessorRef.current = null;
    }
    if (sttMediaStreamRef.current) {
      try {
        sttMediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      sttMediaStreamRef.current = null;
    }
    if (sttAudioCtxRef.current) {
      try {
        void sttAudioCtxRef.current.close();
      } catch {}
      sttAudioCtxRef.current = null;
    }
    if (sttWsRef.current) {
      try {
        if (sttWsRef.current.readyState === WebSocket.OPEN) {
          sttWsRef.current.send(JSON.stringify({ type: 'commit' }));
        }
        sttWsRef.current.close();
      } catch {}
      sttWsRef.current = null;
    }
    setIsSttStreaming(false);
  };

  const startSttStream = async () => {
    if (isSttStreaming) return;
    try {
      if (typeof window === 'undefined') return;
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not available in this browser environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      sttMediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) throw new Error('Web Audio API not supported.');
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      sttAudioCtxRef.current = audioCtx;

      const keyToUse = gatewayKey || (keys.length > 0 ? keys[0].id : 'sk-gw-test-key');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/v1/speech-to-text/realtime?api_key=${encodeURIComponent(
        keyToUse
      )}&model_id=scribe_v2_realtime&audio_format=pcm_16000`;

      const ws = new WebSocket(wsUrl);
      sttWsRef.current = ws;

      ws.onopen = () => {
        setIsSttStreaming(true);
        toast.success('Connected to Realtime STT WebSocket');

        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(2048, 1, 1);
        sttProcessorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const channel = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(channel.length);
          for (let i = 0; i < channel.length; i++) {
            const s = Math.max(-1, Math.min(1, channel[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          let binary = '';
          const bytes = new Uint8Array(pcm16.buffer);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = window.btoa(binary);

          ws.send(
            JSON.stringify({
              message_type: 'input_audio_chunk',
              audio_base_64: base64,
              commit: false,
            })
          );
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.message_type === 'partial_transcript' && msg.text) {
            setSttPartialTranscript(msg.text);
          } else if (msg.message_type === 'committed_transcript' && msg.text) {
            setSttCommittedTranscripts((prev) => [...prev, msg.text]);
            setSttPartialTranscript('');
          }
        } catch {}
      };

      ws.onerror = () => {
        toast.error('STT WebSocket error');
        stopSttStream();
      };
      ws.onclose = () => {
        stopSttStream();
      };
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start mic stream');
      stopSttStream();
    }
  };

  const startTtsTokenStream = () => {
    if (isTtsStreaming || !ttsStreamInputTokens.trim()) return;
    setIsTtsStreaming(true);
    setTtsAudioChunksReceived(0);
    setTtsFirstChunkLatencyMs(null);

    const keyToUse = gatewayKey || (keys.length > 0 ? keys[0].id : 'sk-gw-test-key');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const effectiveVoice =
      selectedVoice === 'custom' ? customVoiceId.trim() || '21m00Tcm4TlvDq8ikWAM' : selectedVoice;
    const wsUrl = `${protocol}//${host}/v1/text-to-speech/${encodeURIComponent(
      effectiveVoice
    )}/stream-input?api_key=${encodeURIComponent(keyToUse)}&model_id=${encodeURIComponent(
      ttsModel
    )}`;

    const ws = new WebSocket(wsUrl);
    ttsWsRef.current = ws;
    const startTime = Date.now();

    ws.onopen = () => {
      // Send initial configuration message
      ws.send(
        JSON.stringify({
          text: ' ',
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        })
      );

      // Stream words with delay to simulate an LLM generating token chunks
      const words = ttsStreamInputTokens.trim().split(/\s+/);
      let idx = 0;
      const interval = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          clearInterval(interval);
          return;
        }
        if (idx < words.length) {
          ws.send(JSON.stringify({ text: words[idx] + ' ' }));
          idx++;
        } else {
          clearInterval(interval);
          ws.send(JSON.stringify({ text: '' })); // End of stream marker
        }
      }, 70);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.audio) {
          setTtsAudioChunksReceived((c) => {
            if (c === 0) {
              setTtsFirstChunkLatencyMs(Date.now() - startTime);
            }
            return c + 1;
          });

          // Play incoming audio chunk
          const binary = window.atob(msg.audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'audio/mp3' });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          void audio.play().catch(() => {});
        }

        if (msg.is_final) {
          setIsTtsStreaming(false);
          toast.success('Audio chunks received and played');
        }
      } catch {}
    };

    ws.onerror = () => {
      toast.error('TTS WebSocket connection error');
      setIsTtsStreaming(false);
    };
    ws.onclose = () => {
      setIsTtsStreaming(false);
    };
  };

  useEffect(() => {
    return () => {
      stopSttStream();
      if (ttsWsRef.current) {
        try {
          ttsWsRef.current.close();
        } catch {}
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* Header and Mode Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Interactive Playground</h1>
            <Badge variant="outline" className="text-[11px] font-mono">
              Chat + Experimental Audio
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Primary surface: chat completions. TTS and STT are experimental and outside the curated OpenAI-compatible catalog.
          </p>
        </div>

        {/* Tab switchers */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'chat' | 'tts' | 'stt')} className="self-start sm:self-auto">
          <TabsList className="h-9">
            <TabsTrigger value="chat" onClick={() => setActiveTab('chat')} className="text-xs gap-1.5 px-3">
              <Play className="size-3.5" />
              <span>Chat</span>
            </TabsTrigger>
            <TabsTrigger value="tts" onClick={() => setActiveTab('tts')} className="text-xs gap-1.5 px-3">
              <Volume2 className="size-3.5" />
              <span>TTS</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px] font-normal">
                Exp
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="stt" onClick={() => setActiveTab('stt')} className="text-xs gap-1.5 px-3">
              <Mic className="size-3.5" />
              <span>STT</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px] font-normal">
                Exp
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Target Configuration Bar */}
      <Card className="border-border/80 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Gateway API Key</Label>
              <Input
                type="password"
                placeholder={keys.length > 0 ? `Auto: ${keys[0].prefix}...` : 'sk-gw-...'}
                value={gatewayKey}
                onChange={(e) => setGatewayKey(e.target.value)}
                className="font-mono text-xs bg-background/50 h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Select Model or Routable Alias</Label>
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
              className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-5 bg-background/40"
            >
              {/* Empty state when no message sent */}
              {!userMessage && !assistantOutput && !isStreaming && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground my-auto">
                  <Bot className="size-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-medium text-foreground">Playground Session</p>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    Enter a prompt below or select an example to test model responses.
                  </p>
                </div>
              )}

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
                      <Collapsible
                        open={isReasoningOpen}
                        onOpenChange={setIsReasoningOpen}
                        className="rounded-lg border border-border/80 bg-zinc-950/40 p-2.5 text-xs font-mono"
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-semibold w-full justify-between h-auto p-0"
                          >
                            <span className="flex items-center gap-1.5">
                              <Brain className="size-3.5 text-primary" />
                              <span>Thought process</span>
                            </span>
                            {isReasoningOpen ? (
                              <ChevronDown className="size-3" />
                            ) : (
                              <ChevronRight className="size-3" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 text-zinc-400 whitespace-pre-wrap leading-relaxed text-[11px] border-t border-border/40 pt-2 max-h-48 overflow-y-auto custom-scrollbar">
                            {reasoningOutput}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
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
            <span className="text-[11px] text-muted-foreground font-medium">
              Examples:
            </span>
            {PROMPT_SUGGESTIONS.map((suggestion, idx) => (
              <Button
                key={idx}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPrompt(suggestion)}
                className="text-[11px] h-7 px-2.5 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/50 font-normal"
              >
                {suggestion}
              </Button>
            ))}
          </div>

          {/* Prompt Input Box */}
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-3">
              <div className="flex flex-col gap-2">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                  className="w-full rounded-md border-0 bg-transparent p-1 text-sm font-sans focus-visible:ring-0 resize-none leading-relaxed shadow-none"
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Volume2 className="size-4 text-primary" />
                  Text-to-Speech Synthesis
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    Experimental
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Experimental audio (outside the curated catalog). Generate complete audio via HTTP or stream token chunks via WebSocket.
                </CardDescription>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg border border-border/60 self-start sm:self-auto">
                <Button
                  variant={ttsMode === 'batch' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setTtsMode('batch')}
                  className="h-7 text-xs px-2.5"
                >
                  Batch (HTTP)
                </Button>
                <Button
                  variant={ttsMode === 'stream-input' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setTtsMode('stream-input')}
                  className="h-7 text-xs px-2.5 gap-1 text-primary font-semibold"
                >
                  <Radio className="size-3 text-rose-500 animate-pulse" />
                  Stream-Input (WS)
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Voice & Model Configuration Panel */}
            <div className="flex flex-col gap-4 p-4 rounded-xl border border-border/80 bg-muted/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Voice ID Selection */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <AudioLines className="size-3.5 text-primary" />
                      <span>Voice Preset / ID</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void refetchVoices()}
                        disabled={isFetchingVoices}
                        className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                        title="Sync Voices from ElevenLabs account"
                      >
                        <RefreshCw className={`size-3 mr-1 ${isFetchingVoices ? 'animate-spin' : ''}`} />
                        <span>Sync</span>
                      </Button>
                      {selectedVoice !== 'custom' && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {selectedVoice}
                        </span>
                      )}
                    </div>
                  </div>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger className="h-9 text-xs bg-background/50">
                      <SelectValue placeholder="Select a Voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {liveVoices.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-xs font-sans text-muted-foreground">
                            Your ElevenLabs Account Voices
                          </SelectLabel>
                          {liveVoices.map((v) => (
                            <SelectItem key={v.id} value={v.id} className="text-xs">
                              <span className="font-medium">{v.name}</span>
                              <span className="text-muted-foreground ml-2 text-[11px]">
                                — {v.category} {v.isFreeSupported ? '(Free)' : '[Paid Plan]'}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {PRESET_VOICES.map((group) => (
                        <SelectGroup key={group.category}>
                          <SelectLabel className="text-xs font-sans text-muted-foreground">
                            {group.category}
                          </SelectLabel>
                          {group.voices.map((v) => (
                            <SelectItem key={v.id} value={v.id} className="text-xs">
                              <span className="font-medium">{v.name}</span>
                              <span className="text-muted-foreground ml-2 text-[11px]">
                                — {v.description}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                      <SelectGroup>
                        <SelectLabel className="text-xs font-sans text-muted-foreground">
                          Custom Voice
                        </SelectLabel>
                        <SelectItem value="custom" className="text-xs font-medium text-primary">
                          Other / Custom Voice ID...
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. TTS Model Selection */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sliders className="size-3.5 text-primary" />
                    <span>TTS Synthesis Model</span>
                  </Label>
                  <Select value={ttsModel} onValueChange={setTtsModel}>
                    <SelectTrigger className="h-9 text-xs bg-background/50 font-mono">
                      <SelectValue placeholder="Select TTS Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="text-xs font-sans text-muted-foreground">ElevenLabs Models</SelectLabel>
                        <SelectItem value="eleven_flash_v2_5" className="text-xs font-mono">
                          eleven_flash_v2_5 (Ultra-low latency ~75ms)
                        </SelectItem>
                        <SelectItem value="eleven_multilingual_v2" className="text-xs font-mono">
                          eleven_multilingual_v2 (High expressive quality)
                        </SelectItem>
                        <SelectItem value="eleven_turbo_v2_5" className="text-xs font-mono">
                          eleven_turbo_v2_5 (Fast streaming)
                        </SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel className="text-xs font-sans text-muted-foreground">OpenAI Models</SelectLabel>
                        <SelectItem value="tts-1" className="text-xs font-mono">
                          tts-1 (Standard)
                        </SelectItem>
                        <SelectItem value="tts-1-hd" className="text-xs font-mono">
                          tts-1-hd (High Definition)
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Custom Voice ID Input */}
                {selectedVoice === 'custom' && (
                  <div className="flex flex-col gap-1.5 md:col-span-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-primary flex items-center gap-1.5">
                        <span>Enter Custom Voice ID</span>
                      </Label>
                      <span className="text-[11px] text-muted-foreground">
                        Paste any ElevenLabs voice ID or custom voice identifier
                      </span>
                    </div>
                    <Input
                      placeholder="e.g. 21m00Tcm4TlvDq8ikWAM or custom_voice_slug"
                      value={customVoiceId}
                      onChange={(e) => setCustomVoiceId(e.target.value)}
                      className="font-mono text-xs bg-background/50 h-9"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Warning if a Library Voice is Selected */}
              {isSelectedVoiceLibrary && (
                <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-200">
                  <AlertTriangle className="size-4 text-amber-400" />
                  <AlertTitle className="text-xs font-semibold text-amber-300">
                    ElevenLabs Paid Plan Required for this Voice
                  </AlertTitle>
                  <AlertDescription className="text-amber-200/90 leading-relaxed text-[11px] mt-0.5">
                    This is a community <strong>&quot;Voice Library&quot;</strong> voice requiring a paid ElevenLabs plan.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* BATCH SYNTHESIS MODE */}
            {ttsMode === 'batch' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground">Text to Speak (HTTP)</Label>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {ttsText.length} characters
                    </span>
                  </div>
                  <Textarea
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    rows={4}
                    placeholder="Enter text to synthesize into high quality speech..."
                    className="w-full bg-background/50 p-3 text-sm leading-relaxed"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSynthesizeTts}
                    disabled={isSynthesizing || !ttsText.trim()}
                    className="flex items-center gap-2 shadow-sm"
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = audioUrl;
                        a.download = `speech-${Date.now()}.mp3`;
                        a.click();
                      }}
                      className="text-xs flex items-center gap-1.5"
                    >
                      Download MP3
                    </Button>
                  )}
                </div>

                {audioUrl && (
                  <div className="p-4 rounded-xl border border-border/80 bg-muted/20 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <AudioLines className="size-3.5 text-primary" />
                        Generated Audio Output
                      </span>
                      <span className="font-mono text-[11px]">MP3 Stream</span>
                    </div>
                    <audio controls src={audioUrl} className="w-full rounded-lg" autoPlay />
                  </div>
                )}
              </div>
            )}

            {/* STREAM-INPUT WEBSOCKET MODE */}
            {ttsMode === 'stream-input' && (
              <div className="flex flex-col gap-4">
                <Alert className="border-border/60 bg-background/40">
                  <Info className="size-3.5 text-primary" />
                  <AlertDescription className="text-[11px] text-muted-foreground">
                    <strong>Stream-Input WebSocket Protocol:</strong> Streams text token-by-token into{' '}
                    <InlineCode>/v1/text-to-speech/:voiceId/stream-input</InlineCode> and plays base64 audio chunks back with sub-100ms latency.
                  </AlertDescription>
                </Alert>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground">Text Tokens to Stream</Label>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Simulates streaming LLM tokens
                    </Badge>
                  </div>
                  <Textarea
                    value={ttsStreamInputTokens}
                    onChange={(e) => setTtsStreamInputTokens(e.target.value)}
                    rows={3}
                    placeholder="Enter text to stream in chunk by chunk..."
                    className="w-full bg-background/50 p-3 text-sm leading-relaxed"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={startTtsTokenStream}
                    disabled={isTtsStreaming || !ttsStreamInputTokens.trim()}
                    className="flex items-center gap-2 shadow-sm bg-primary text-primary-foreground"
                  >
                    {isTtsStreaming ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Streaming Tokens...</span>
                      </>
                    ) : (
                      <>
                        <Radio className="size-4 text-rose-400" />
                        <span>Stream Text Chunks</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Real-time Streaming Metrics */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border/80 bg-muted/20">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground">Time to First Audio (TTFA)</span>
                    <span className="text-base font-bold font-mono text-emerald-400">
                      {ttsFirstChunkLatencyMs !== null ? `${ttsFirstChunkLatencyMs}ms` : '—'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground">Audio Chunks Received</span>
                    <span className="text-base font-bold font-mono text-foreground">
                      {ttsAudioChunksReceived}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STT TAB */}
      {activeTab === 'stt' && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mic className="size-4 text-primary" />
                  Speech-to-Text Transcription
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    Experimental
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Experimental audio (outside the curated catalog). Transcribe via HTTP or stream microphone chunks via WebSocket.
                </CardDescription>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg border border-border/60 self-start sm:self-auto">
                <Button
                  variant={sttMode === 'batch' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSttMode('batch')}
                  className="h-7 text-xs px-2.5"
                >
                  File Upload (HTTP)
                </Button>
                <Button
                  variant={sttMode === 'realtime' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSttMode('realtime')}
                  className="h-7 text-xs px-2.5 gap-1 text-primary font-semibold"
                >
                  <Radio className="size-3 text-rose-500 animate-pulse" />
                  Realtime Stream (WS)
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* BATCH FILE UPLOAD MODE */}
            {sttMode === 'batch' && (
              <div className="flex flex-col gap-4">
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
              </div>
            )}

            {/* REALTIME STREAMING WEBSOCKET MODE */}
            {sttMode === 'realtime' && (
              <div className="flex flex-col gap-4">
                <Alert className="border-border/60 bg-background/40">
                  <Info className="size-3.5 text-primary" />
                  <AlertDescription className="text-[11px] text-muted-foreground">
                    <strong>Realtime STT WebSocket Protocol:</strong> Streams microphone chunks into{' '}
                    <InlineCode>/v1/speech-to-text/realtime</InlineCode> and renders live partial &amp; committed transcripts as you speak.
                  </AlertDescription>
                </Alert>

                <div className="flex items-center gap-3">
                  {!isSttStreaming ? (
                    <Button
                      onClick={startSttStream}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      <Radio className="size-4" />
                      <span>Start Streaming Audio (Mic)</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={stopSttStream}
                      variant="destructive"
                      className="flex items-center gap-2"
                    >
                      <Square className="size-4" />
                      <span>Stop &amp; Commit Speech</span>
                    </Button>
                  )}
                  {isSttStreaming && (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 gap-1.5 animate-pulse">
                      <span className="size-2 rounded-full bg-emerald-400" />
                      Streaming Microphone Audio (PCM16 @ 16kHz)
                    </Badge>
                  )}
                </div>

                {/* Live Interim Partial Transcript */}
                {isSttStreaming && (
                  <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] text-primary font-semibold">
                      <span>Interim Speech (Live Partial)</span>
                      <span className="font-mono text-[10px] animate-pulse">listening...</span>
                    </div>
                    <p className="text-sm italic text-foreground">
                      {sttPartialTranscript ? `"${sttPartialTranscript}"` : 'Listening for voice...'}
                    </p>
                  </div>
                )}

                {/* Committed Final Transcripts */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Committed Final Transcripts ({sttCommittedTranscripts.length})
                    </span>
                    {sttCommittedTranscripts.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSttCommittedTranscripts([])}
                        className="h-5 px-1.5 text-[10px] text-muted-foreground"
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  {sttCommittedTranscripts.length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                      No speech segments committed yet. Click &quot;Start Streaming Audio&quot; and speak.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {sttCommittedTranscripts.map((text, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-black/30 border border-border/80 text-xs text-foreground leading-relaxed flex items-start gap-2"
                        >
                          <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                            #{idx + 1}
                          </Badge>
                          <span>{text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
