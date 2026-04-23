import { Check, ChevronDown, Keyboard, Laptop, Lock, Trash2, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AccessibilityNotice } from '@/components/AccessibilityGate/AccessibilityGate';
import { CapturePill, type PillState } from '@/components/CapturePill/CapturePill';
import { ChordPicker } from '@/components/ChordPicker/ChordPicker';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { useCaptureSettings } from '@/lib/hooks/useSettings';
import { useProfiles } from '@/lib/hooks/useProfiles';
import { cn } from '@/lib/utils/cn';
import { displayLabelForKey, modifierSideHint } from '@/lib/utils/keyCodes';
import type { Qwen3ModelSize, VoiceProfileResponse, WhisperModelSize } from '@/lib/api/types';
import { SettingRow, SettingSection } from './SettingRow';

const VOICE_GRADIENTS = [
  'from-blue-400 to-indigo-500',
  'from-emerald-400 to-teal-500',
  'from-purple-500 to-fuchsia-500',
  'from-amber-400 to-rose-500',
  'from-rose-400 to-pink-500',
  'from-cyan-400 to-sky-500',
];

function voiceGradient(voiceId: string): string {
  // Stable hash so the same voice always renders with the same gradient —
  // avoids the avatar flicker that would happen if we picked by index.
  let hash = 0;
  for (let i = 0; i < voiceId.length; i += 1) {
    hash = (hash * 31 + voiceId.charCodeAt(i)) | 0;
  }
  return VOICE_GRADIENTS[Math.abs(hash) % VOICE_GRADIENTS.length];
}

function ChordPreview({ keys }: { keys: string[] }) {
  if (keys.length === 0) {
    return <span className="text-xs text-muted-foreground italic">Not set</span>;
  }
  return (
    <div className="flex items-center gap-1">
      {keys.map((k) => {
        const side = modifierSideHint(k);
        return (
          <span
            key={k}
            className="relative inline-flex items-center justify-center h-6 min-w-[1.5rem] px-1.5 rounded-md border border-border bg-muted/60 font-mono text-[11px] font-medium shadow-sm text-foreground"
          >
            {displayLabelForKey(k)}
            {side ? (
              <span className="absolute -top-1 -right-1 h-3 min-w-[0.75rem] px-0.5 rounded-sm bg-accent text-[7px] font-bold leading-none flex items-center justify-center text-accent-foreground">
                {side}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

const PILL_SEQUENCE: PillState[] = ['recording', 'transcribing', 'refining', 'rest'];
const PILL_DURATIONS: Partial<Record<PillState, number>> = {
  recording: 2600,
  transcribing: 1500,
  refining: 1500,
  rest: 900,
};

function HotkeyPillPreview({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<PillState>('recording');
  const [tick, setTick] = useState(0);

  // Cycle recording → transcribing → refining → rest → …
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = PILL_SEQUENCE[(PILL_SEQUENCE.indexOf(state) + 1) % PILL_SEQUENCE.length];
      setState(next);
    }, PILL_DURATIONS[state] ?? 1000);
    return () => window.clearTimeout(t);
  }, [state]);

  // Timer only advances while recording; holds its final value through
  // transcribing and refining so users see the duration of the clip being
  // processed.
  useEffect(() => {
    if (state !== 'recording') return;
    setTick(0);
    const iv = window.setInterval(() => setTick((n) => n + 1), 90);
    return () => window.clearInterval(iv);
  }, [state]);

  const elapsedMs = tick * 90;

  return (
    <div
      className={cn(
        'relative rounded-xl border overflow-hidden transition-opacity',
        'bg-muted/30',
        'aspect-[6/1]',
        enabled ? 'border-border' : 'border-border/50 opacity-50',
      )}
      style={{
        backgroundImage: `
          linear-gradient(to right, hsl(var(--foreground) / 0.06) 1px, transparent 1px),
          linear-gradient(to bottom, hsl(var(--foreground) / 0.06) 1px, transparent 1px)
        `,
        backgroundSize: '22px 22px',
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <CapturePill state={state} elapsedMs={elapsedMs} />
      </div>
    </div>
  );
}

export function CapturesPage() {
  const { settings, update } = useCaptureSettings();
  const { data: profiles } = useProfiles();
  const sttModel = settings?.stt_model ?? 'turbo';
  const language = settings?.language ?? 'auto';
  const autoRefine = settings?.auto_refine ?? true;
  const llmModel = settings?.llm_model ?? '0.6B';
  const smartCleanup = settings?.smart_cleanup ?? true;
  const selfCorrection = settings?.self_correction ?? true;
  const preserveTechnical = settings?.preserve_technical ?? true;
  const allowAutoPaste = settings?.allow_auto_paste ?? true;
  const defaultVoiceId = settings?.default_playback_voice_id ?? null;
  const pushToTalkKeys = settings?.chord_push_to_talk_keys ?? ['MetaRight', 'AltGr'];
  const toggleToTalkKeys = settings?.chord_toggle_to_talk_keys ?? ['MetaRight', 'AltGr', 'Space'];

  // Mock-only settings — not yet wired to a backend. Keep local so the UI
  // still responds while Phase 7 (hotkey / clipboard / paste) catches up.
  const [archiveAudio, setArchiveAudio] = useState(true);
  const [hotkeyEnabled, setHotkeyEnabled] = useState(true);
  const [copyToClipboard, setCopyToClipboard] = useState(true);
  const [retention, setRetention] = useState('forever');
  const [chordEditor, setChordEditor] = useState<'push' | 'toggle' | null>(null);

  const voices: VoiceProfileResponse[] = profiles ?? [];
  const defaultVoice =
    voices.find((v) => v.id === defaultVoiceId) ?? null;

  return (
    <div className="flex gap-8 items-start max-w-5xl">
      <div className="flex-1 min-w-0 max-w-2xl space-y-10">
      <SettingSection
        title="Dictation"
        description="Capture from anywhere on your machine with a global shortcut."
      >
        <SettingRow
          title="Global shortcut"
          description="Hold the shortcut to record. Release to transcribe. Requires an Accessibility permission the first time you enable it."
          htmlFor="hotkeyEnabled"
          action={
            <Toggle id="hotkeyEnabled" checked={hotkeyEnabled} onCheckedChange={setHotkeyEnabled} />
          }
        />

        <SettingRow
          title="Push-to-talk shortcut"
          description="Hold these keys anywhere on your system to record. Release to stop and transcribe."
          action={
            <div className="flex items-center gap-2">
              <ChordPreview keys={pushToTalkKeys} />
              <Button
                variant="outline"
                size="sm"
                disabled={!hotkeyEnabled}
                onClick={() => setChordEditor('push')}
              >
                <Keyboard className="h-3.5 w-3.5 mr-1.5" />
                Change
              </Button>
            </div>
          }
        />

        <SettingRow
          title="Toggle shortcut"
          description="Press once to start a hands-free recording. Press again to stop. Usually push-to-talk plus Space."
          action={
            <div className="flex items-center gap-2">
              <ChordPreview keys={toggleToTalkKeys} />
              <Button
                variant="outline"
                size="sm"
                disabled={!hotkeyEnabled}
                onClick={() => setChordEditor('toggle')}
              >
                <Keyboard className="h-3.5 w-3.5 mr-1.5" />
                Change
              </Button>
            </div>
          }
        />

        <ChordPicker
          open={chordEditor === 'push'}
          title="Set push-to-talk shortcut"
          description="Hold the keys you want to use, then release and click Save. The right-hand modifier badge shows whether a key is the left or right variant."
          initialKeys={pushToTalkKeys}
          onCancel={() => setChordEditor(null)}
          onSave={(keys) => {
            update({ chord_push_to_talk_keys: keys });
            setChordEditor(null);
          }}
        />

        <ChordPicker
          open={chordEditor === 'toggle'}
          title="Set toggle shortcut"
          description="Hold the keys you want to use, then release and click Save. Pick something distinct from your push-to-talk chord."
          initialKeys={toggleToTalkKeys}
          onCancel={() => setChordEditor(null)}
          onSave={(keys) => {
            update({ chord_toggle_to_talk_keys: keys });
            setChordEditor(null);
          }}
        />

        <SettingRow
          title="Preview"
          description="What appears on screen while you're holding the shortcut."
        >
          <HotkeyPillPreview enabled={hotkeyEnabled} />
        </SettingRow>

        <SettingRow
          title="Copy transcript to clipboard"
          description="The cleaned transcript lands on your clipboard when the capture finishes."
          htmlFor="copyToClipboard"
          action={
            <Toggle
              id="copyToClipboard"
              checked={copyToClipboard}
              onCheckedChange={setCopyToClipboard}
              disabled={!hotkeyEnabled}
            />
          }
        />

        <div>
          <SettingRow
            title="Auto-paste into focused text field"
            description="If a text input is focused in another app, paste directly into it. Voicebox saves and restores whatever was on your clipboard."
            htmlFor="autoPaste"
            action={
              <Toggle
                id="autoPaste"
                checked={allowAutoPaste}
                onCheckedChange={(v) => update({ allow_auto_paste: v })}
                disabled={!hotkeyEnabled}
              />
            }
          />
          <AccessibilityNotice />
        </div>
      </SettingSection>

      <SettingSection
        title="Transcription"
        description="Pick which speech-to-text model runs on your captures."
      >
        <SettingRow
          title="Transcription model"
          description="Whisper ships with Voicebox and runs entirely on your machine."
          action={
            <Select
              value={sttModel}
              onValueChange={(v) => update({ stt_model: v as WhisperModelSize })}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base">Whisper Base · 74M · Fast</SelectItem>
                <SelectItem value="small">Whisper Small · 244M · Balanced</SelectItem>
                <SelectItem value="medium">
                  Whisper Medium · 769M · Higher accuracy
                </SelectItem>
                <SelectItem value="large">
                  Whisper Large · 1.5B · Best accuracy
                </SelectItem>
                <SelectItem value="turbo">
                  Whisper Turbo · Pruned Large v3 · Near-best, fast
                </SelectItem>
              </SelectContent>
            </Select>
          }
        />

        <SettingRow
          title="Language"
          description="Auto-detect works for most captures. Lock it if you're always speaking the same language."
          action={
            <Select value={language} onValueChange={(v) => update({ language: v })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
              </SelectContent>
            </Select>
          }
        />

        <SettingRow
          title="Archive audio"
          description="Keep the original recording alongside every transcript."
          htmlFor="archiveAudio"
          action={<Toggle id="archiveAudio" checked={archiveAudio} onCheckedChange={setArchiveAudio} />}
        />
      </SettingSection>

      <SettingSection
        title="Refinement"
        description="Optionally run a local LLM over transcripts to clean filler words, punctuation, and self-corrections."
      >
        <SettingRow
          title="Refine transcripts automatically"
          description="Runs after every capture. You can still toggle between raw and refined in the Captures tab."
          htmlFor="autoRefine"
          action={
            <Toggle
              id="autoRefine"
              checked={autoRefine}
              onCheckedChange={(v) => update({ auto_refine: v })}
            />
          }
        />

        <SettingRow
          title="Refinement model"
          description="Larger models are slower but handle subtle self-corrections and technical vocabulary better."
          action={
            <Select
              value={llmModel}
              onValueChange={(v) => update({ llm_model: v as Qwen3ModelSize })}
              disabled={!autoRefine}
            >
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.6B">Qwen3 · 0.6B · 400 MB · Very fast</SelectItem>
                <SelectItem value="1.7B">Qwen3 · 1.7B · 1.1 GB · Fast</SelectItem>
                <SelectItem value="4B">Qwen3 · 4B · 2.5 GB · Full quality</SelectItem>
              </SelectContent>
            </Select>
          }
        />

        <SettingRow
          title="Smart cleanup"
          description="Remove filler words (um, uh, like), restore punctuation, and fix capitalization without rephrasing."
          htmlFor="smartCleanup"
          action={
            <Toggle
              id="smartCleanup"
              checked={smartCleanup}
              onCheckedChange={(v) => update({ smart_cleanup: v })}
              disabled={!autoRefine}
            />
          }
        />

        <SettingRow
          title="Remove self-corrections"
          description={'When you change your mind mid-sentence ("actually, no...", "wait, I meant..."), drop the retracted part and keep the final intent.'}
          htmlFor="selfCorrection"
          action={
            <Toggle
              id="selfCorrection"
              checked={selfCorrection}
              onCheckedChange={(v) => update({ self_correction: v })}
              disabled={!autoRefine}
            />
          }
        />

        <SettingRow
          title="Preserve technical terms"
          description="Keep code identifiers, command names, and acronyms exactly as spoken. Turn on when you dictate into a code prompt."
          htmlFor="preserveTechnical"
          action={
            <Toggle
              id="preserveTechnical"
              checked={preserveTechnical}
              onCheckedChange={(v) => update({ preserve_technical: v })}
              disabled={!autoRefine}
            />
          }
        />
      </SettingSection>

      <SettingSection
        title="Playback"
        description='Default voice for the "Play as" action in the Captures tab.'
      >
        <SettingRow
          title="Default voice"
          description="Used when you click Play as without picking a voice first. You can change it per capture."
          action={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 min-w-[220px] justify-between"
                  disabled={voices.length === 0}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {defaultVoice ? (
                      <>
                        <div
                          className={cn(
                            'h-5 w-5 rounded-full bg-gradient-to-br shrink-0 ring-1 ring-white/10',
                            voiceGradient(defaultVoice.id),
                          )}
                        />
                        <span className="truncate">{defaultVoice.name}</span>
                      </>
                    ) : (
                      <span className="truncate text-muted-foreground">
                        {voices.length === 0 ? 'No cloned voices yet' : 'None selected'}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Cloned voices
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {voices.map((v) => (
                  <DropdownMenuItem
                    key={v.id}
                    onClick={() => update({ default_playback_voice_id: v.id })}
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
                      {v.description ? (
                        <div className="text-[11px] text-muted-foreground truncate">
                          {v.description}
                        </div>
                      ) : null}
                    </div>
                    {v.id === defaultVoiceId && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      </SettingSection>

      <SettingSection
        title="Storage"
        description="Captures are saved as paired audio and transcript files in your Voicebox data directory."
      >
        <SettingRow
          title="Retention"
          description="How long to keep captures. Applies to both audio and transcripts."
          action={
            <Select value={retention} onValueChange={setRetention}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="forever">Keep forever</SelectItem>
                <SelectItem value="90d">90 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="7d">7 days</SelectItem>
              </SelectContent>
            </Select>
          }
        />

        <SettingRow
          title="Clear all captures"
          description="Permanently delete every capture and its audio. This cannot be undone."
          action={
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear captures
            </Button>
          }
        />
      </SettingSection>
      </div>

      <aside className="hidden lg:block w-[280px] shrink-0 space-y-6 sticky top-0">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">About Captures</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Hold a shortcut anywhere on your machine, speak, and Voicebox turns
            your voice into text. Replay it in any cloned voice, paste it into
            any app, or pipe it into your coding agent.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">What's different</h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2.5">
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
              <span className="leading-relaxed">
                <span className="text-foreground font-medium">Fully local.</span>{' '}
                Whisper and the refinement LLM run on your hardware. No cloud,
                no accounts, your voice never leaves the machine.
              </span>
            </li>
            <li className="flex gap-2.5">
              <Volume2 className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
              <span className="leading-relaxed">
                <span className="text-foreground font-medium">
                  Play as any voice.
                </span>{' '}
                Transcripts can be read back in any profile you've cloned.
              </span>
            </li>
            <li className="flex gap-2.5">
              <Laptop className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
              <span className="leading-relaxed">
                <span className="text-foreground font-medium">
                  Cross-platform.
                </span>{' '}
                Same shortcut, same flow on macOS, Windows, and Linux.
              </span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
