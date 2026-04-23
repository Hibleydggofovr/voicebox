import { invoke } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { useCaptureSettings } from '@/lib/hooks/useSettings';
import { usePlatform } from '@/platform/PlatformContext';

/**
 * Push the user's saved chord into the running Rust `HotkeyMonitor`.
 * The monitor boots with hard-coded right-hand defaults; this hook
 * replaces them as soon as capture_settings resolves and re-applies on
 * every subsequent change so chord edits land without a restart.
 *
 * Call once from the main app shell — multiple call sites would just
 * fire redundant invokes, since the chord engine swap is the same value
 * either way.
 */
export function useChordSync() {
  const platform = usePlatform();
  const { settings } = useCaptureSettings();
  const pushKeys = settings?.chord_push_to_talk_keys;
  const toggleKeys = settings?.chord_toggle_to_talk_keys;

  useEffect(() => {
    if (!platform.metadata.isTauri) return;
    if (!pushKeys || !toggleKeys) return;
    invoke('update_chord_bindings', {
      pushToTalk: pushKeys,
      toggleToTalk: toggleKeys,
    }).catch((err) => {
      console.warn('[chord-sync] failed to update bindings:', err);
    });
  }, [
    platform.metadata.isTauri,
    // Stringify so a referentially-new array with the same content
    // doesn't fire a redundant invoke on every settings refetch.
    pushKeys?.join(','),
    toggleKeys?.join(','),
  ]);
}
