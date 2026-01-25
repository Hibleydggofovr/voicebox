import { Download, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import { useDeleteGeneration, useHistory } from '@/lib/hooks/useHistory';
import { formatDate, formatDuration } from '@/lib/utils/format';

export function HistoryTable() {
  const [page, setPage] = useState(0);
  const limit = 20;
  const { toast } = useToast();

  const { data: historyData, isLoading } = useHistory({
    limit,
    offset: page * limit,
  });

  const deleteGeneration = useDeleteGeneration();

  const handlePlay = (audioId: string) => {
    const audioUrl = apiClient.getAudioUrl(audioId);
    const audio = new Audio(audioUrl);
    audio.play().catch((_error) => {
      toast({
        title: 'Error',
        description: 'Failed to play audio',
        variant: 'destructive',
      });
    });
  };

  const handleDownload = (audioId: string, text: string) => {
    const audioUrl = apiClient.getAudioUrl(audioId);
    const filename = `${text.substring(0, 30).replace(/[^a-z0-9]/gi, '_')}.wav`;
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading history...</div>
      </div>
    );
  }

  const history = historyData?.items || [];
  const total = historyData?.total || 0;
  const hasMore = history.length === limit && (page + 1) * limit < total;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Generation History</h2>

      {history.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No generation history yet. Generate your first audio to see it here.
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Text</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((gen) => (
                <TableRow key={gen.id}>
                  <TableCell className="max-w-[300px] truncate">{gen.text}</TableCell>
                  <TableCell>{gen.profile_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{gen.language}</Badge>
                  </TableCell>
                  <TableCell>{formatDuration(gen.duration)}</TableCell>
                  <TableCell>{formatDate(gen.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePlay(gen.id)}
                        aria-label="Play audio"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(gen.id, gen.text)}
                        aria-label="Download audio"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteGeneration.mutate(gen.id)}
                        disabled={deleteGeneration.isPending}
                        aria-label="Delete generation"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <div className="text-sm text-muted-foreground flex items-center">
              Page {page + 1} • {total} total
            </div>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
