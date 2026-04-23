import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Accessibility,
  CheckCircle2,
  Circle,
  Cpu,
  Download,
  ExternalLink,
  Keyboard,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import type { DictationReadiness, ReadinessGate } from '@/lib/hooks/useDictationReadiness';
import { cn } from '@/lib/utils/cn';

interface RowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  ready: boolean;
  action?: React.ReactNode;
}

function ChecklistRow({ icon, title, description, ready, action }: RowProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3.5 transition-colors',
        ready ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border bg-muted/20',
      )}
    >
      <div className="mt-0.5 shrink-0">
        {ready ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground/50" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <p className="text-sm font-medium text-foreground">{title}</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        {!ready && action ? <div className="pt-1.5">{action}</div> : null}
      </div>
    </div>
  );
}

/**
 * Renders one row per dictation-readiness gate. Each unmet gate gets an
 * inline action — Download for missing models, Open Settings for missing
 * TCC permissions — so the user can resolve everything without leaving
 * Captures.
 *
 * The chord stays disarmed until every row is green; this is what stops the
 * "stuck pill" failure mode of pressing the chord with a missing model.
 */
export function DictationReadinessChecklist({ readiness }: { readiness: DictationReadiness }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<Set<ReadinessGate>>(new Set());

  const downloadMutation = useMutation({
    mutationFn: async ({ modelName }: { gate: ReadinessGate; modelName: string }) =>
      apiClient.triggerModelDownload(modelName),
    onSuccess: (_data, vars) => {
      // Bump model status + readiness so the checklist row flips green as
      // soon as the cache is populated. Keep the gate in `downloading` until
      // readiness reports `ready: true` to avoid a flash of "Download" on
      // post-completion polls.
      queryClient.invalidateQueries({ queryKey: ['modelStatus'] });
      queryClient.invalidateQueries({ queryKey: ['capture-readiness'] });
      toast({
        title: 'Download started',
        description: `${vars.gate === 'stt' ? readiness.stt?.display_name : readiness.llm?.display_name} is downloading. The shortcut will arm itself when it finishes.`,
      });
    },
    onError: (err: Error, vars) => {
      setDownloading((prev) => {
        const next = new Set(prev);
        next.delete(vars.gate);
        return next;
      });
      toast({
        title: 'Download failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const startDownload = (gate: ReadinessGate, modelName: string) => {
    setDownloading((prev) => new Set(prev).add(gate));
    downloadMutation.mutate({ gate, modelName });
  };

  // Once readiness flips ready=true for a gate, drop it from `downloading`
  // so subsequent reopens show the green check, not "Downloading…".
  const isDownloading = (gate: ReadinessGate, ready: boolean) => !ready && downloading.has(gate);

  const sttSize =
    readiness.stt?.size_mb != null ? `${(readiness.stt.size_mb / 1000).toFixed(1)} GB` : null;
  const llmSize =
    readiness.llm?.size_mb != null ? `${(readiness.llm.size_mb / 1000).toFixed(1)} GB` : null;

  return (
    <div className="w-full max-w-md mx-auto space-y-2.5">
      <div className="text-center mb-5 space-y-1">
        <h2 className="text-base font-semibold text-foreground">
          A few things before you can dictate
        </h2>
        <p className="text-xs text-muted-foreground">
          The shortcut stays off until everything below is ready.
        </p>
      </div>

      {readiness.stt && (
        <ChecklistRow
          icon={<Cpu className="h-3.5 w-3.5" />}
          title={`${readiness.stt.display_name} (speech-to-text)`}
          description={
            readiness.stt.ready
              ? 'Model downloaded.'
              : `Needed to transcribe your audio${sttSize ? ` · ${sttSize}` : ''}.`
          }
          ready={readiness.stt.ready}
          action={
            <Button
              size="sm"
              onClick={() => startDownload('stt', readiness.stt!.model_name)}
              disabled={isDownloading('stt', readiness.stt.ready)}
              className="gap-1.5"
            >
              {isDownloading('stt', readiness.stt.ready) ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Downloading…
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  Download
                </>
              )}
            </Button>
          }
        />
      )}

      {readiness.llm && (
        <ChecklistRow
          icon={<Cpu className="h-3.5 w-3.5" />}
          title={`${readiness.llm.display_name} (refinement)`}
          description={
            readiness.llm.ready
              ? 'Model downloaded.'
              : `Cleans up the raw transcript before paste${llmSize ? ` · ${llmSize}` : ''}.`
          }
          ready={readiness.llm.ready}
          action={
            <Button
              size="sm"
              onClick={() => startDownload('llm', readiness.llm!.model_name)}
              disabled={isDownloading('llm', readiness.llm.ready)}
              className="gap-1.5"
            >
              {isDownloading('llm', readiness.llm.ready) ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Downloading…
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  Download
                </>
              )}
            </Button>
          }
        />
      )}

      <ChecklistRow
        icon={<Keyboard className="h-3.5 w-3.5" />}
        title="Input Monitoring permission"
        description={
          readiness.inputMonitoring
            ? 'macOS allows Voicebox to detect your global shortcut.'
            : 'macOS needs to allow Voicebox to detect the global shortcut.'
        }
        ready={readiness.inputMonitoring}
        action={
          <Button size="sm" onClick={readiness.openInputMonitoringSettings} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Open Settings
          </Button>
        }
      />

      <ChecklistRow
        icon={<Accessibility className="h-3.5 w-3.5" />}
        title="Accessibility permission"
        description={
          readiness.accessibility
            ? 'Voicebox can paste transcriptions into other apps.'
            : 'Required so transcriptions can paste into the focused app.'
        }
        ready={readiness.accessibility}
        action={
          <Button size="sm" onClick={readiness.openAccessibilitySettings} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Open Settings
          </Button>
        }
      />
    </div>
  );
}
