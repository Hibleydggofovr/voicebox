import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import type { ActiveDownloadTask } from '@/lib/api/types';
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
        ready ? 'border-accent/20 bg-accent/5' : 'border-border bg-muted/20',
      )}
    >
      <div className="mt-0.5 shrink-0">
        {ready ? (
          <CheckCircle2 className="h-5 w-5 text-accent" />
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

function progressPercent(task: ActiveDownloadTask | undefined): number | null {
  if (!task) return null;
  if (typeof task.progress === 'number')
    return Math.round(Math.max(0, Math.min(100, task.progress)));
  if (task.current && task.total) return Math.round((task.current / task.total) * 100);
  return null;
}

/**
 * Renders one row per dictation-readiness gate. Each unmet gate gets an
 * inline action — Download for missing models, Open Settings for missing
 * TCC permissions — so the user can resolve everything without leaving
 * Captures.
 *
 * Download-in-progress state is sourced from ``/tasks/active`` (same query
 * the Models page uses) so it survives unmount: navigating away and back
 * still shows "Downloading…" instead of resetting to "Download".
 *
 * The chord stays disarmed until every row is green; this is what stops the
 * "stuck pill" failure mode of pressing the chord with a missing model.
 */
export function DictationReadinessChecklist({ readiness }: { readiness: DictationReadiness }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: activeTasks } = useQuery({
    queryKey: ['activeTasks'],
    queryFn: () => apiClient.getActiveTasks(),
    // Mirror ModelManagement's cadence: 1s while a download is in flight,
    // 5s otherwise. Keeps progress feeling live without hammering when idle.
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasActive = data?.downloads.some((d) => d.status === 'downloading');
      return hasActive ? 1000 : 5000;
    },
  });

  const downloadByModel = new Map<string, ActiveDownloadTask>();
  for (const dl of activeTasks?.downloads ?? []) {
    if (dl.status === 'downloading') downloadByModel.set(dl.model_name, dl);
  }

  // When a download disappears from activeTasks, it just finished — refetch
  // readiness immediately so the row flips to ✓ instead of waiting up to 5s
  // for the next readiness poll.
  const prevActive = useRef<Set<string>>(new Set());
  useEffect(() => {
    const current = new Set(downloadByModel.keys());
    for (const name of prevActive.current) {
      if (!current.has(name)) {
        queryClient.invalidateQueries({ queryKey: ['capture-readiness'] });
        queryClient.invalidateQueries({ queryKey: ['modelStatus'] });
        break;
      }
    }
    prevActive.current = current;
  }, [activeTasks, queryClient, downloadByModel]);

  const downloadMutation = useMutation({
    mutationFn: async ({ modelName }: { gate: ReadinessGate; modelName: string }) =>
      apiClient.triggerModelDownload(modelName),
    onSuccess: (_data, vars) => {
      // Bump activeTasks so the row immediately shows "Downloading…" without
      // waiting for the next 5s poll. modelStatus + readiness invalidations
      // keep adjacent UI in sync.
      queryClient.invalidateQueries({ queryKey: ['activeTasks'] });
      queryClient.invalidateQueries({ queryKey: ['modelStatus'] });
      queryClient.invalidateQueries({ queryKey: ['capture-readiness'] });
      const displayName =
        vars.gate === 'stt' ? readiness.stt?.display_name : readiness.llm?.display_name;
      toast({
        title: t('captures.readiness.downloadStarted'),
        description: t('captures.readiness.downloadStartedDescription', { name: displayName }),
      });
    },
    onError: (err: Error) => {
      toast({
        title: t('captures.readiness.downloadFailed'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const sttSize =
    readiness.stt?.size_mb != null ? `${(readiness.stt.size_mb / 1000).toFixed(1)} GB` : null;
  const llmSize =
    readiness.llm?.size_mb != null ? `${(readiness.llm.size_mb / 1000).toFixed(1)} GB` : null;

  function modelDownloadButton(
    gate: 'stt' | 'llm',
    modelName: string,
    ready: boolean,
  ): React.ReactNode {
    const task = downloadByModel.get(modelName);
    const downloading = !ready && !!task;
    const pct = progressPercent(task);
    return (
      <Button
        size="sm"
        onClick={() => downloadMutation.mutate({ gate, modelName })}
        disabled={downloading || downloadMutation.isPending}
        className="gap-1.5"
      >
        {downloading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {pct != null
              ? t('captures.readiness.downloadingPercent', { pct })
              : t('captures.readiness.downloading')}
          </>
        ) : (
          <>
            <Download className="h-3.5 w-3.5" />
            {t('captures.readiness.downloadButton')}
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-2.5">
      <div className="text-center mb-5 space-y-1">
        <h2 className="text-base font-semibold text-foreground">
          {t('captures.readiness.title')}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t('captures.readiness.subheading')}
        </p>
      </div>

      {readiness.stt && (
        <ChecklistRow
          icon={<Cpu className="h-3.5 w-3.5" />}
          title={t('captures.readiness.stt.label', { name: readiness.stt.display_name })}
          description={
            readiness.stt.ready
              ? t('captures.readiness.stt.ready')
              : sttSize
                ? t('captures.readiness.stt.missingWithSize', { size: sttSize })
                : t('captures.readiness.stt.missing')
          }
          ready={readiness.stt.ready}
          action={modelDownloadButton('stt', readiness.stt.model_name, readiness.stt.ready)}
        />
      )}

      {readiness.llm && (
        <ChecklistRow
          icon={<Cpu className="h-3.5 w-3.5" />}
          title={t('captures.readiness.llm.label', { name: readiness.llm.display_name })}
          description={
            readiness.llm.ready
              ? t('captures.readiness.llm.ready')
              : llmSize
                ? t('captures.readiness.llm.missingWithSize', { size: llmSize })
                : t('captures.readiness.llm.missing')
          }
          ready={readiness.llm.ready}
          action={modelDownloadButton('llm', readiness.llm.model_name, readiness.llm.ready)}
        />
      )}

      <ChecklistRow
        icon={<Keyboard className="h-3.5 w-3.5" />}
        title={t('captures.readiness.inputMonitoring.label')}
        description={
          readiness.inputMonitoring
            ? t('captures.readiness.inputMonitoring.ready')
            : t('captures.readiness.inputMonitoring.missing')
        }
        ready={readiness.inputMonitoring}
        action={
          <Button size="sm" onClick={readiness.openInputMonitoringSettings} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            {t('captures.readiness.inputMonitoring.openSettings')}
          </Button>
        }
      />

      <ChecklistRow
        icon={<Accessibility className="h-3.5 w-3.5" />}
        title={t('captures.readiness.accessibility.label')}
        description={
          readiness.accessibility
            ? t('captures.readiness.accessibility.ready')
            : t('captures.readiness.accessibility.missing')
        }
        ready={readiness.accessibility}
        action={
          <Button size="sm" onClick={readiness.openAccessibilitySettings} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            {t('captures.readiness.accessibility.openSettings')}
          </Button>
        }
      />
    </div>
  );
}
