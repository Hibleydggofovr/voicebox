import { useEffect, useRef, useState } from 'react';
import { useServerStore } from '@/stores/serverStore';

/** Payload for a speak-start SSE event broadcast by the backend. */
export interface ActiveSpeak {
  generationId: string;
  profileName: string;
  source: 'mcp' | 'rest' | string;
  clientId: string | null;
  startedAt: number;
  elapsedMs: number;
}

/**
 * Subscribes to `/events/speak` and reports whichever agent-initiated
 * speak is currently producing audio. Returns ``null`` when nothing is
 * speaking.
 *
 * Multiple concurrent speaks are rare (the model can only really do one
 * at a time) and we don't bother stacking them — newest wins, the old
 * one's speak-end will clear when it fires.
 */
export function useSpeakEvents(): ActiveSpeak | null {
  const [active, setActive] = useState<ActiveSpeak | null>(null);
  const activeRef = useRef<ActiveSpeak | null>(null);
  activeRef.current = active;

  // Keep a live timer so the pill's elapsed label advances smoothly
  // without re-opening the SSE stream.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const iv = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(iv);
  }, [active]);

  useEffect(() => {
    const baseUrl = useServerStore.getState().serverUrl;
    if (!baseUrl) return;

    let cancelled = false;
    let source: EventSource | null = null;

    const connect = () => {
      if (cancelled) return;
      source = new EventSource(`${baseUrl}/events/speak`);

      source.addEventListener('speak-start', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const now = Date.now();
          setActive({
            generationId: String(data.generation_id ?? ''),
            profileName: String(data.profile_name ?? ''),
            source: String(data.source ?? 'mcp'),
            clientId: data.client_id ?? null,
            startedAt: now,
            elapsedMs: 0,
          });
        } catch {
          // malformed payload — ignore, don't crash the stream
        }
      });

      source.addEventListener('speak-end', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const endedId = String(data.generation_id ?? '');
          // Only clear if this end matches the currently-active id; late
          // ends from previous sessions are ignored.
          if (activeRef.current?.generationId === endedId) setActive(null);
        } catch {
          // ignore
        }
      });

      source.onerror = () => {
        // EventSource auto-reconnects, but if the browser gives up we
        // manually retry with backoff.
        source?.close();
        if (!cancelled) window.setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      cancelled = true;
      source?.close();
    };
  }, []);

  if (!active) return null;
  return { ...active, elapsedMs: Date.now() - active.startedAt };
}
