import { invoke } from '@tauri-apps/api/core';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useEffect, useRef } from 'react';
import { CapturePill } from '@/components/CapturePill/CapturePill';
import type { FocusSnapshot } from '@/lib/api/types';
import { useCaptureRecordingSession } from '@/lib/hooks/useCaptureRecordingSession';
import { useSpeakEvents } from '@/lib/hooks/useSpeakEvents';

/**
 * Floating dictate surface shown in a separate transparent Tauri window.
 * Mounted when the URL contains ``?view=dictate``. The main window bypasses
 * this branch and renders the full app shell.
 *
 * The pill is driven entirely by the global chord / toggle shortcut — there
 * is no fallback button here because the window is only visible while a
 * capture cycle is in flight.
 */
export function DictateWindow() {
  // Force the host document chrome to be transparent so the Tauri window
  // takes on the pill's own shape.
  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
    };
  }, []);

  // Snapshot of the focused UI element at chord-start, shipped over from
  // Rust on the ``dictate:start`` payload. Held in a ref so it survives
  // the 1–2 s transcribe + refine window — the paste only fires once the
  // final text comes back.
  const focusRef = useRef<FocusSnapshot | null>(null);

  const session = useCaptureRecordingSession({
    onFinalText: async (text, _capture, allowAutoPaste) => {
      const focus = focusRef.current;
      // Consume-once: a second chord before this fires would overwrite
      // focusRef, but nulling it here guards against the late-arriving
      // refine-result firing a paste after the user has moved on.
      focusRef.current = null;
      if (!allowAutoPaste) return;
      if (!focus || !text.trim()) return;
      try {
        await invoke('paste_final_text', { text, focus });
      } catch (err) {
        // Surface accessibility failures to the main window so it can prompt
        // the user to grant permission. Other errors stay swallowed —
        // the transcription still landed in the captures list.
        const msg = err instanceof Error ? err.message : String(err);
        if (/accessibility/i.test(msg)) {
          emit('system:accessibility-missing').catch(() => {});
        }
        console.warn('[dictate] paste_final_text failed:', err);
      }
    },
  });

  // Route the chord events emitted from Rust into the session hook. Using a
  // ref so the `listen` effect only subscribes once — rebinding every render
  // would thrash the Tauri event bridge.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    const unlistens: Promise<UnlistenFn>[] = [];
    unlistens.push(
      listen<{ focus: FocusSnapshot | null }>('dictate:start', (event) => {
        focusRef.current = event.payload?.focus ?? null;
        sessionRef.current.startRecording();
      }),
    );
    unlistens.push(
      listen('dictate:stop', () => {
        if (sessionRef.current.isRecording) sessionRef.current.stopRecording();
      }),
    );
    return () => {
      for (const p of unlistens) p.then((fn) => fn()).catch(() => {});
    };
  }, []);

  // Subscribe to agent-initiated speak events so the pill surfaces while
  // voicebox.speak (MCP) or POST /speak is producing audio. We ask Rust
  // to show the pill window by emitting `dictate:show` — the existing
  // `dictate:hide` happens on cycle end below.
  const speaking = useSpeakEvents();
  const prevSpeakingIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = speaking?.generationId ?? null;
    if (id && id !== prevSpeakingIdRef.current) {
      emit('dictate:show').catch(() => {});
    }
    prevSpeakingIdRef.current = id;
  }, [speaking?.generationId]);

  // Compose the effective pill state: speak events override the capture
  // session when both would render, because agent speech is always
  // category-mattering (the user can't hear two pills). Elapsed time
  // restarts for speaking so the timer reflects playback length.
  const isSpeaking = Boolean(speaking);
  const effectiveState = isSpeaking ? 'speaking' : session.pillState;
  const effectiveElapsed = isSpeaking ? speaking!.elapsedMs : session.pillElapsedMs;

  // When the pill cycle ends (no capture AND no speak), tell Rust to tuck
  // the window away. Rust owns the hide + park-off-screen + click-through
  // combo because calling hide() directly from JS has been unreliable for
  // transparent always-on-top windows on macOS.
  useEffect(() => {
    if (effectiveState === 'hidden') {
      emit('dictate:hide').catch(() => {});
    }
  }, [effectiveState]);

  return (
    <div
      className="h-screen w-screen flex items-center justify-center px-3"
      style={{ background: 'transparent' }}
    >
      {effectiveState !== 'hidden' ? (
        <CapturePill
          state={effectiveState}
          elapsedMs={effectiveElapsed}
          errorMessage={session.errorMessage}
          onDismiss={session.dismissError}
          onStop={session.isRecording ? session.stopRecording : undefined}
        />
      ) : null}
    </div>
  );
}
