import { invoke } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { useCaptureSettings } from '@/lib/hooks/useSettings';
import { usePlatform } from '@/platform/PlatformContext';

/**
 * Spawn (or quiet) the global hotkey monitor based on the saved
 * `capture_settings.hotkey_enabled` flag, and keep its bindings in sync with
 * the user's chord choices.
 *
 * Boot sequence:
 *  - hotkey_enabled = false → call `disable_hotkey` (no-op if monitor was
 *    never spawned). Crucially, we do *not* call `enable_hotkey`, so the
 *    macOS Input Monitoring TCC prompt is never triggered for users who
 *    haven't opted in.
 *  - hotkey_enabled = true → call `enable_hotkey` with the saved chords.
 *    This is the call that creates the CGEventTap and triggers the TCC
 *    prompt on first opt-in.
 *
 * Call once from the main app shell.
 */
export function useChordSync() {
  const platform = usePlatform();
  const { settings } = useCaptureSettings();
  const enabled = settings?.hotkey_enabled;
  const pushKeys = settings?.chord_push_to_talk_keys;
  const toggleKeys = settings?.chord_toggle_to_talk_keys;

  useEffect(() => {
    if (!platform.metadata.isTauri) return;
    if (enabled === undefined || !pushKeys || !toggleKeys) return;
    const command = enabled ? 'enable_hotkey' : 'disable_hotkey';
    const args = enabled
      ? { pushToTalk: pushKeys, toggleToTalk: toggleKeys }
      : {};
    invoke(command, args).catch((err) => {
      console.warn(`[chord-sync] ${command} failed:`, err);
    });
  }, [
    platform.metadata.isTauri,
    enabled,
    // Stringify so a referentially-new array with the same content
    // doesn't fire a redundant invoke on every settings refetch.
    pushKeys?.join(','),
    toggleKeys?.join(','),
  ]);
}
