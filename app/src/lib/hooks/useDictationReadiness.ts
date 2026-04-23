import { useQuery } from '@tanstack/react-query';
import { useAccessibilityPermission } from '@/components/AccessibilityGate/AccessibilityGate';
import { useInputMonitoringPermission } from '@/components/InputMonitoringGate/InputMonitoringGate';
import { apiClient } from '@/lib/api/client';
import type { ModelReadiness } from '@/lib/api/types';
import { usePlatform } from '@/platform/PlatformContext';

const READINESS_POLL_INTERVAL_MS = 5_000;

export type ReadinessGate = 'stt' | 'llm' | 'input_monitoring' | 'accessibility';

export interface DictationReadiness {
  isLoading: boolean;
  allReady: boolean;
  /** Subset of gates that are NOT yet satisfied — what the checklist renders. */
  missing: ReadinessGate[];
  stt: ModelReadiness | undefined;
  llm: ModelReadiness | undefined;
  inputMonitoring: boolean;
  accessibility: boolean;
  refetch: () => void;
  openInputMonitoringSettings: () => Promise<void>;
  openAccessibilitySettings: () => Promise<void>;
  recheckInputMonitoring: () => Promise<boolean>;
  recheckAccessibility: () => Promise<boolean>;
}

/**
 * Single source of truth for "can the user trigger dictation right now?"
 *
 * Combines four gates into one struct so the chord-sync hook can refuse to
 * arm the global hotkey unless every gate is green — the "stuck pill" we
 * used to get on missing models is solved by never letting the chord fire
 * in the first place.
 *
 * Gates:
 *  - stt / llm: backend ``/capture/readiness`` (polled, since downloads
 *    finish out-of-band — e.g. user kicks off a download in another tab and
 *    expects the toggle to auto-unlock when it lands)
 *  - input_monitoring / accessibility: macOS TCC checks via Tauri commands
 *    (rechecked on window focus by the underlying hooks)
 *
 * Hotkey-enabled is the user's intent toggle and is intentionally *not*
 * a gate here — that's `useChordSync`'s concern.
 */
export function useDictationReadiness(): DictationReadiness {
  const platform = usePlatform();
  const isTauri = platform.metadata.isTauri;

  const {
    needsPermission: inputMonNeeds,
    recheck: recheckInputMon,
    openSettings: openInputMon,
  } = useInputMonitoringPermission();
  const {
    needsPermission: a11yNeeds,
    recheck: recheckA11y,
    openSettings: openA11y,
  } = useAccessibilityPermission();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['capture-readiness'],
    queryFn: () => apiClient.getCaptureReadiness(),
    refetchInterval: READINESS_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  // On the web build there's no TCC layer — treat both as granted so the
  // checklist doesn't block users who can't even open System Settings.
  const inputMonitoring = isTauri ? !inputMonNeeds : true;
  const accessibility = isTauri ? !a11yNeeds : true;
  const sttReady = data?.stt.ready ?? false;
  const llmReady = data?.llm.ready ?? false;

  const missing: ReadinessGate[] = [];
  if (!sttReady) missing.push('stt');
  if (!llmReady) missing.push('llm');
  if (!inputMonitoring) missing.push('input_monitoring');
  if (!accessibility) missing.push('accessibility');

  return {
    isLoading,
    allReady: missing.length === 0,
    missing,
    stt: data?.stt,
    llm: data?.llm,
    inputMonitoring,
    accessibility,
    refetch: () => {
      refetch();
    },
    openInputMonitoringSettings: openInputMon,
    openAccessibilitySettings: openA11y,
    recheckInputMonitoring: recheckInputMon,
    recheckAccessibility: recheckA11y,
  };
}
