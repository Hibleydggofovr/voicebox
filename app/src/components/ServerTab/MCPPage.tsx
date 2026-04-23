import { Check, Copy, Plug, Trash2, Waypoints } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMCPBindings } from '@/lib/hooks/useMCPBindings';
import { useProfiles } from '@/lib/hooks/useProfiles';
import { useCaptureSettings } from '@/lib/hooks/useSettings';
import { useServerStore } from '@/stores/serverStore';
import { SettingRow, SettingSection } from './SettingRow';

/**
 * Settings → MCP — configure per-agent voice binding and show copy-paste
 * install snippets for major MCP clients. Backend runs at /mcp on the
 * existing Voicebox server; this page is the agent-onboarding surface.
 */
export function MCPPage() {
  const serverUrl = useServerStore((s) => s.serverUrl);
  const { bindings, upsertAsync, remove } = useMCPBindings();
  const { data: profiles } = useProfiles();
  const { settings: captureSettings, update: updateCapture } = useCaptureSettings();

  const defaultProfileId = captureSettings?.default_playback_voice_id ?? '';
  const mcpUrl = `${serverUrl}/mcp`;

  const [newClientId, setNewClientId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newProfileId, setNewProfileId] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newClientId.trim()) return;
    setAdding(true);
    try {
      await upsertAsync({
        client_id: newClientId.trim(),
        label: newLabel.trim() || null,
        profile_id: newProfileId || null,
      });
      setNewClientId('');
      setNewLabel('');
      setNewProfileId('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex gap-8 items-start max-w-5xl">
      <div className="flex-1 min-w-0 max-w-2xl space-y-8">
        <SettingSection
          title="Install into your agent"
          description="Voicebox exposes a local MCP server whenever the app is open. Paste one of these snippets into your agent's MCP config."
        >
          <SnippetRow
            title="HTTP (recommended)"
            description="For clients that speak HTTP MCP — Claude Code, Cursor, Windsurf, VS Code."
            snippet={JSON.stringify(
              {
                mcpServers: {
                  voicebox: {
                    url: mcpUrl,
                    headers: { 'X-Voicebox-Client-Id': 'claude-code' },
                  },
                },
              },
              null,
              2,
            )}
          />
          <SnippetRow
            title="Claude Code one-liner"
            description="Registers via the Claude Code CLI."
            snippet={`claude mcp add voicebox --transport http --url ${mcpUrl} --header "X-Voicebox-Client-Id: claude-code"`}
          />
          <SnippetRow
            title="Stdio (fallback)"
            description="For clients that only spawn stdio processes. The shim binary ships with the app."
            snippet={JSON.stringify(
              {
                mcpServers: {
                  voicebox: {
                    command:
                      '/Applications/Voicebox.app/Contents/MacOS/voicebox-mcp',
                    env: { VOICEBOX_CLIENT_ID: 'claude-code' },
                  },
                },
              },
              null,
              2,
            )}
          />
        </SettingSection>

        <SettingSection
          title="Default voice"
          description="Used when an agent calls voicebox.speak without a specific profile and has no per-client binding."
        >
          <SettingRow
            title="Default playback voice"
            description="Shared with the Captures-tab 'Play as voice' dropdown — one default voice for passive playback."
            action={
              <select
                value={defaultProfileId}
                onChange={(e) =>
                  updateCapture({
                    default_playback_voice_id: e.target.value || null,
                  })
                }
                className="h-8 px-2 rounded-md border bg-background text-sm min-w-[180px]"
              >
                <option value="">(none)</option>
                {(profiles ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            }
          />
        </SettingSection>

        <SettingSection
          title="Per-agent voice"
          description="Bind specific agents to specific voices so you can tell who's speaking without looking. The agent identifies itself by the X-Voicebox-Client-Id header (or VOICEBOX_CLIENT_ID env for stdio)."
        >
          {bindings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 italic">
              No bindings yet. Add one below, then configure your MCP client to
              send the matching <code>X-Voicebox-Client-Id</code>.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {bindings.map((b) => (
                <div
                  key={b.client_id}
                  className="py-3 grid grid-cols-[1fr_auto_auto] gap-4 items-center"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {b.label || b.client_id}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      <code className="text-[11px]">{b.client_id}</code>
                      {' · '}
                      {b.last_seen_at ? (
                        <span title={`Last seen ${b.last_seen_at}`}>
                          <Plug className="inline h-3 w-3 text-emerald-500" />{' '}
                          last seen {formatRelative(b.last_seen_at)}
                        </span>
                      ) : (
                        <span>never connected</span>
                      )}
                    </div>
                  </div>
                  <select
                    value={b.profile_id ?? ''}
                    onChange={(e) =>
                      upsertAsync({
                        client_id: b.client_id,
                        label: b.label,
                        profile_id: e.target.value || null,
                      })
                    }
                    className="h-8 px-2 rounded-md border bg-background text-sm min-w-[160px]"
                  >
                    <option value="">(default)</option>
                    {(profiles ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(b.client_id)}
                    aria-label={`Remove binding for ${b.client_id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 space-y-2">
            <div className="text-sm font-medium">Add a binding</div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                type="text"
                placeholder="client id (e.g. claude-code)"
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value)}
                className="h-9 px-3 rounded-md border bg-background text-sm"
              />
              <input
                type="text"
                placeholder="label (optional)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="h-9 px-3 rounded-md border bg-background text-sm"
              />
              <select
                value={newProfileId}
                onChange={(e) => setNewProfileId(e.target.value)}
                className="h-9 px-2 rounded-md border bg-background text-sm min-w-[140px]"
              >
                <option value="">(default)</option>
                {(profiles ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newClientId.trim() || adding}
            >
              Add binding
            </Button>
          </div>
        </SettingSection>
      </div>

      <aside className="hidden lg:block w-[280px] shrink-0 space-y-6 sticky top-0">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">About MCP</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Model Context Protocol lets your AI coding agent — Claude Code,
            Cursor, Windsurf — call Voicebox tools. Speak in a cloned voice,
            transcribe audio, browse captures.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Available tools</h3>
          <ul className="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
            <li>
              <code className="text-accent">voicebox.speak</code>
              <div>Speak text in a voice profile.</div>
            </li>
            <li>
              <code className="text-accent">voicebox.transcribe</code>
              <div>Whisper STT on a clip.</div>
            </li>
            <li>
              <code className="text-accent">voicebox.list_captures</code>
              <div>Recent dictations / recordings.</div>
            </li>
            <li>
              <code className="text-accent">voicebox.list_profiles</code>
              <div>Available voice profiles.</div>
            </li>
          </ul>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Waypoints className="h-3.5 w-3.5 text-accent" />
          <span>
            Also exposed as <code>POST /speak</code> for shell scripts, ACP,
            A2A.
          </span>
        </div>
      </aside>
    </div>
  );
}

function SnippetRow({
  title,
  description,
  snippet,
}: {
  title: string;
  description: string;
  snippet: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore; user can still select-and-copy the pre content
    }
  };

  return (
    <div className="py-3 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy
            </>
          )}
        </Button>
      </div>
      <pre className="text-[11px] font-mono p-3 rounded-md bg-muted/50 overflow-x-auto whitespace-pre-wrap break-all">
        {snippet}
      </pre>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} h ago`;
  return `${Math.floor(diff / 86400_000)} d ago`;
}
