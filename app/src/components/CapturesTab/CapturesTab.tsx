import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  Captions,
  Check,
  ChevronDown,
  CircleDot,
  Copy,
  FileAudio,
  Loader2,
  Mic,
  Play,
  Send,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CapturePill } from '@/components/CapturePill/CapturePill';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import type {
  CaptureListResponse,
  CaptureResponse,
  CaptureSource,
  VoiceProfileResponse,
} from '@/lib/api/types';
import type { LanguageCode } from '@/lib/constants/languages';
import { BOTTOM_SAFE_AREA_PADDING } from '@/lib/constants/ui';
import { useCaptureRecordingSession } from '@/lib/hooks/useCaptureRecordingSession';
import { useCaptureSettings } from '@/lib/hooks/useSettings';
import { cn } from '@/lib/utils/cn';
import { usePlayerStore } from '@/stores/playerStore';

const CAPTURE_AUDIO_MIME = 'audio/*,.wav,.mp3,.m4a,.flac,.ogg,.webm';

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function formatDuration(ms?: number | null): string {
  if (!ms || ms < 0) return '0:00';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function snippetOf(capture: CaptureResponse): string {
  const source = capture.transcript_refined || capture.transcript_raw || '';
  return source.trim() || '(no transcript)';
}

function SourceBadge({ source }: { source: CaptureSource }) {
  const Icon = source === 'dictation' ? Mic : source === 'recording' ? CircleDot : FileAudio;
  const label = source === 'dictation' ? 'Dictation' : source === 'recording' ? 'Recording' : 'File';
  return (
    <Badge
      variant="secondary"
      className="h-5 px-1.5 text-[10px] gap-1 font-medium bg-muted/60 text-muted-foreground"
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </Badge>
  );
}

function FakeWaveform({ seed = 1, className }: { seed?: number; className?: string }) {
  const bars = useMemo(() => {
    return Array.from({ length: 72 }).map((_, i) => {
      const h =
        28 +
        Math.sin(i * 0.35 + seed) * 22 +
        Math.cos(i * 0.81 + seed * 2) * 14 +
        Math.sin(i * 1.7 + seed * 3) * 8;
      return Math.max(6, Math.min(96, h));
    });
  }, [seed]);

  return (
    <div className={cn('flex items-center gap-[2px] h-10', className)}>
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-foreground/25"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

type PlaybackState = 'idle' | 'generating' | 'playing';

function voiceGradient(profileId: string): string {
  const gradients = [
    'from-blue-400 to-indigo-500',
    'from-emerald-400 to-teal-500',
    'from-purple-500 to-fuchsia-500',
    'from-amber-400 to-rose-500',
    'from-rose-400 to-pink-500',
    'from-cyan-400 to-sky-500',
  ];
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) hash = (hash * 31 + profileId.charCodeAt(i)) | 0;
  return gradients[Math.abs(hash) % gradients.length];
}

export function CapturesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showRefined, setShowRefined] = useState(true);
  const [playAsVoiceId, setPlayAsVoiceId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');

  const setAudioWithAutoPlay = usePlayerStore((s) => s.setAudioWithAutoPlay);
  const audioUrl = usePlayerStore((s) => s.audioUrl);
  const isPlayerVisible = !!audioUrl;

  const { settings: captureSettings } = useCaptureSettings();
  const sttModel = captureSettings?.stt_model ?? 'turbo';
  const llmModel = captureSettings?.llm_model ?? '0.6B';

  const session = useCaptureRecordingSession({
    onCaptureCreated: (capture) => setSelectedId(capture.id),
  });

  const { data: capturesData, isLoading: capturesLoading } = useQuery({
    queryKey: ['captures'],
    queryFn: () => apiClient.listCaptures(200, 0),
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => apiClient.listProfiles(),
  });

  const captures = capturesData?.items ?? [];

  // Keep a selection. If the current selection disappears (e.g. deletion),
  // fall through to the first capture, then to null.
  useEffect(() => {
    if (!captures.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !captures.find((c) => c.id === selectedId)) {
      setSelectedId(captures[0].id);
    }
  }, [captures, selectedId]);

  // Default the Play-as voice to the first profile we see.
  useEffect(() => {
    if (!playAsVoiceId && profiles && profiles.length) {
      setPlayAsVoiceId(profiles[0].id);
    }
  }, [profiles, playAsVoiceId]);

  // Live sync from sibling Tauri webviews (the floating dictate window).
  // ``capture:created`` carries the full row so we can seed the cache before
  // the refetch lands and focus the new capture in one shot — without the
  // seed, the selection-guard effect would snap back to ``captures[0]`` in
  // the race window between ``setSelectedId(new)`` and the refetched list
  // actually containing the new row.
  useEffect(() => {
    const unlistens: Promise<UnlistenFn>[] = [];
    unlistens.push(
      listen<{ capture: CaptureResponse }>('capture:created', (event) => {
        const capture = event.payload?.capture;
        if (capture) {
          queryClient.setQueryData<CaptureListResponse>(['captures'], (prev) => {
            if (!prev) return prev;
            if (prev.items.some((c) => c.id === capture.id)) return prev;
            return { ...prev, items: [capture, ...prev.items], total: prev.total + 1 };
          });
          setSelectedId(capture.id);
        }
        queryClient.invalidateQueries({ queryKey: ['captures'] });
      }),
    );
    unlistens.push(
      listen('capture:updated', () => {
        queryClient.invalidateQueries({ queryKey: ['captures'] });
      }),
    );
    return () => {
      for (const p of unlistens) p.then((fn) => fn()).catch(() => {});
    };
  }, [queryClient]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return captures;
    return captures.filter((c) => {
      const raw = (c.transcript_raw || '').toLowerCase();
      const refined = (c.transcript_refined || '').toLowerCase();
      return raw.includes(q) || refined.includes(q);
    });
  }, [search, captures]);

  const selected = captures.find((c) => c.id === selectedId) ?? null;
  const playAsVoice = profiles?.find((p) => p.id === playAsVoiceId) ?? null;

  const deleteMutation = useMutation({
    mutationFn: async (captureId: string) => apiClient.deleteCapture(captureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['captures'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  const playAsMutation = useMutation({
    mutationFn: async ({ capture, voice }: { capture: CaptureResponse; voice: VoiceProfileResponse }) => {
      const text = capture.transcript_refined || capture.transcript_raw;
      if (!text.trim()) throw new Error('Capture has no transcript yet');
      const language = (capture.language || voice.language) as LanguageCode;
      // Preset profiles (Kokoro etc.) reject the qwen default — honor the
      // profile's stored engine preference. Cloned profiles without an
      // override fall through to whatever the backend picks.
      const engine = voice.default_engine as
        | 'qwen' | 'qwen_custom_voice' | 'luxtts' | 'chatterbox'
        | 'chatterbox_turbo' | 'tada' | 'kokoro'
        | undefined;
      const result = await apiClient.generateSpeech({
        profile_id: voice.id,
        text,
        language,
        engine,
      });
      return { capture, voice, result };
    },
    onSuccess: ({ capture, voice, result }) => {
      if (result.audio_path && result.id) {
        setAudioWithAutoPlay(
          apiClient.getAudioUrl(result.id),
          result.id,
          voice.id,
          `${voice.name} · ${capture.id.slice(0, 8)}`,
        );
        setPlaybackState('playing');
      }
    },
    onError: (err: Error) => {
      setPlaybackState('idle');
      toast({ title: 'Play-as failed', description: err.message, variant: 'destructive' });
    },
  });

  // Pull playback state back to idle when the player closes out.
  useEffect(() => {
    if (!audioUrl) setPlaybackState('idle');
  }, [audioUrl]);

  const handleUploadClick = () => uploadInputRef.current?.click();

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>, source: CaptureSource) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    session.uploadFile(file, source);
  };

  const handlePlayOriginal = () => {
    if (!selected) return;
    setAudioWithAutoPlay(
      apiClient.getCaptureAudioUrl(selected.id),
      `capture-${selected.id}`,
      null,
      `Capture · ${formatDate(selected.created_at)}`,
    );
  };

  const handleCopy = async () => {
    if (!selected) return;
    const text = showRefined
      ? selected.transcript_refined || selected.transcript_raw
      : selected.transcript_raw;
    try {
      await navigator.clipboard.writeText(text || '');
      toast({ title: 'Transcript copied' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const handlePlayAs = (voice?: VoiceProfileResponse) => {
    if (!selected) return;
    const target = voice ?? playAsVoice;
    if (!target) {
      toast({
        title: 'No voice profile',
        description: 'Create a voice profile before using Play as.',
        variant: 'destructive',
      });
      return;
    }
    if (voice && voice.id !== playAsVoiceId) setPlayAsVoiceId(voice.id);
    setPlaybackState('generating');
    playAsMutation.mutate({ capture: selected, voice: target });
  };

  return (
    <div className="h-full flex gap-0 overflow-hidden -mx-8">
      <input
        ref={uploadInputRef}
        type="file"
        accept={CAPTURE_AUDIO_MIME}
        onChange={(e) => handleUploadFile(e, 'file')}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={CAPTURE_AUDIO_MIME}
        onChange={(e) => handleUploadFile(e, 'file')}
        className="hidden"
      />

      {/* Left: capture list */}
      <div className="w-[340px] shrink-0 flex flex-col relative overflow-hidden border-r border-border">
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />

        <div className="absolute top-0 left-0 right-0 z-20 pl-4 pr-4">
          <div className="flex items-center gap-2 mb-5">
            <h1 className="text-2xl px-4 font-bold">Captures</h1>
            <Badge
              variant="secondary"
              className="h-5 px-1.5 text-[10px] font-medium text-accent bg-accent/10 border border-accent/20"
            >
              Beta
            </Badge>
          </div>
          <div className="relative">
            <Input
              placeholder="Search transcripts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-sm rounded-full focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        <div
          className={cn(
            'flex-1 overflow-y-auto overflow-x-hidden pt-24',
            isPlayerVisible && BOTTOM_SAFE_AREA_PADDING,
          )}
        >
          <div className="px-4 pb-6 space-y-1">
            {capturesLoading ? (
              <div className="px-4 py-12 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground space-y-3">
                {search ? (
                  <p>No captures match "{search}"</p>
                ) : (
                  <>
                    <p>No captures yet.</p>
                    <Button variant="outline" size="sm" onClick={handleUploadClick}>
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Import audio
                    </Button>
                  </>
                )}
              </div>
            ) : (
              filtered.map((capture) => {
                const isActive = selectedId === capture.id;
                const refined = !!capture.transcript_refined;
                return (
                  <button
                    type="button"
                    key={capture.id}
                    onClick={() => setSelectedId(capture.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg transition-colors block',
                      isActive
                        ? 'bg-muted/70 border border-border'
                        : 'border border-transparent hover:bg-muted/30',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {formatRelative(capture.created_at)}
                      </span>
                      <div className="flex-1" />
                      <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                        {formatDuration(capture.duration_ms)}
                      </span>
                    </div>
                    <div className="text-[13px] text-foreground/90 line-clamp-2 leading-snug mb-2">
                      {snippetOf(capture)}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <SourceBadge source={capture.source} />
                      {refined && (
                        <Badge
                          variant="secondary"
                          className="h-5 px-1.5 text-[10px] gap-1 font-medium bg-accent/10 text-accent border border-accent/20"
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          Refined
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right: capture detail */}
      <div className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />

        {/* Top action bar */}
        <div className="absolute top-0 left-0 right-0 z-20 px-8">
          <div className="flex items-center gap-3 py-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>
                Whisper {sttModel.charAt(0).toUpperCase() + sttModel.slice(1)}
                <span className="mx-1.5 text-muted-foreground/40">·</span>
                Qwen3 · {llmModel}
              </span>
            </div>
            <div className="flex-1" />
            {session.pillState !== 'hidden' && (
              <CapturePill
                state={session.pillState}
                elapsedMs={session.pillElapsedMs}
                errorMessage={session.errorMessage}
                onDismiss={session.dismissError}
                onStop={session.isRecording ? session.stopRecording : undefined}
              />
            )}
            {session.pillState === 'hidden' && (
              <>
                <Button variant="outline" asChild>
                  <Link to="/settings/captures">
                    <Settings2 className="mr-2 h-4 w-4" />
                    Configure
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleUploadClick}
                  disabled={session.isUploading}
                >
                  {session.isUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {session.isUploading ? 'Uploading...' : 'Import'}
                </Button>
              </>
            )}
            <Button
              onClick={session.toggleRecording}
              disabled={session.isUploading && !session.isRecording}
              className="relative overflow-hidden transition-all bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {session.isRecording ? (
                <>
                  <Square className="h-4 w-4 mr-2 fill-current" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Dictate
                </>
              )}
            </Button>
          </div>
        </div>

        {selected ? (
          <div
            className={cn(
              'flex-1 overflow-y-auto pt-20 px-8 pb-8',
              isPlayerVisible && BOTTOM_SAFE_AREA_PADDING,
            )}
          >
            {/* Meta row */}
            <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
              <span>{formatDate(selected.created_at)}</span>
              {selected.language && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{selected.language.toUpperCase()}</span>
                </>
              )}
              <span className="text-muted-foreground/40">·</span>
              <SourceBadge source={selected.source} />
            </div>

            {/* Audio player card */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 mb-6">
              <div className="flex items-center gap-4">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 rounded-full shrink-0"
                  onClick={handlePlayOriginal}
                >
                  <Play className="h-4 w-4 ml-0.5" />
                </Button>
                <FakeWaveform
                  seed={selected.id.charCodeAt(0)}
                  className="flex-1"
                />
                <span className="text-xs tabular-nums text-muted-foreground font-medium">
                  {formatDuration(selected.duration_ms)}
                </span>
              </div>
            </div>

            {/* Transcript header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="inline-flex rounded-md bg-muted/40 p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => setShowRefined(true)}
                  disabled={!selected.transcript_refined}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    showRefined && selected.transcript_refined
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground disabled:opacity-40',
                  )}
                >
                  <Sparkles className="h-3 w-3 inline-block mr-1 -translate-y-px" />
                  Refined
                </button>
                <button
                  type="button"
                  onClick={() => setShowRefined(false)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    !showRefined || !selected.transcript_refined
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Captions className="h-3 w-3 inline-block mr-1 -translate-y-px" />
                  Raw
                </button>
              </div>
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {showRefined && selected.transcript_refined
                  ? `Refined with Qwen3 · ${selected.llm_model ?? llmModel}`
                  : selected.stt_model
                    ? `Transcribed with Whisper ${selected.stt_model}`
                    : null}
              </span>
            </div>

            {/* Transcript body */}
            <div className="rounded-xl border border-border bg-muted/10">
              <Textarea
                key={`${selected.id}-${showRefined}`}
                defaultValue={
                  showRefined && selected.transcript_refined
                    ? selected.transcript_refined
                    : selected.transcript_raw
                }
                readOnly
                className="text-[15px] leading-relaxed min-h-[260px] border-0 bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0 p-6"
              />
            </div>

            {/* Bottom actions */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <div className="inline-flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePlayAs()}
                  disabled={!playAsVoice || playAsMutation.isPending}
                  className={cn(
                    'gap-2 rounded-r-none border-r-0 pr-3 pl-2 transition-colors',
                    playbackState !== 'idle' &&
                      'border-accent/50 text-foreground bg-accent/10 hover:bg-accent/15',
                  )}
                >
                  {playAsVoice && (
                    <div
                      className={cn(
                        'h-5 w-5 rounded-full bg-gradient-to-br shrink-0 ring-1 ring-white/10',
                        voiceGradient(playAsVoice.id),
                        playbackState === 'playing' && 'animate-pulse',
                      )}
                    />
                  )}
                  {playbackState === 'generating' ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating…
                    </>
                  ) : playbackState === 'playing' ? (
                    <>
                      <Square className="h-3 w-3 fill-current" />
                      Stop · {playAsVoice?.name ?? 'Voice'}
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3.5 w-3.5" />
                      {playAsVoice ? `Play as ${playAsVoice.name}` : 'Play as…'}
                    </>
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'rounded-l-none px-2 transition-colors',
                        playbackState !== 'idle' &&
                          'border-accent/50 bg-accent/10 hover:bg-accent/15',
                      )}
                      disabled={!profiles || !profiles.length}
                    >
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      Play transcript as
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {profiles?.map((v) => (
                      <DropdownMenuItem
                        key={v.id}
                        onClick={() => handlePlayAs(v)}
                        className="gap-2.5 py-2"
                      >
                        <div
                          className={cn(
                            'h-7 w-7 rounded-full bg-gradient-to-br shrink-0 ring-1 ring-white/10',
                            voiceGradient(v.id),
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{v.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {v.description || v.language.toUpperCase()}
                          </div>
                        </div>
                        {v.id === playAsVoiceId && (
                          <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => session.refine(selected.id)}
                disabled={session.isRefining}
              >
                {session.isRefining ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                {selected.transcript_refined ? 'Re-refine' : 'Refine'}
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Send to
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate(selected.id)}
                disabled={deleteMutation.isPending}
                className="text-muted-foreground hover:text-destructive"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                )}
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground pt-20">
            <div className="text-center space-y-3">
              <Captions className="h-10 w-10 mx-auto opacity-40" />
              {capturesLoading ? (
                <p className="text-sm">Loading captures…</p>
              ) : captures.length ? (
                <p className="text-sm">Pick a capture to see the transcript.</p>
              ) : (
                <>
                  <p className="text-sm">No captures yet.</p>
                  <Button variant="outline" size="sm" onClick={handleUploadClick}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Import audio
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
