import { Edit, Mic, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { VoiceProfileResponse } from '@/lib/api/types';
import { useDeleteProfile } from '@/lib/hooks/useProfiles';
import { formatDate } from '@/lib/utils/format';
import { useUIStore } from '@/stores/uiStore';
import { ProfileDetail } from './ProfileDetail';

interface ProfileCardProps {
  profile: VoiceProfileResponse;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const deleteProfile = useDeleteProfile();
  const setEditingProfileId = useUIStore((state) => state.setEditingProfileId);
  const setProfileDialogOpen = useUIStore((state) => state.setProfileDialogOpen);

  const handleEdit = () => {
    setEditingProfileId(profile.id);
    setProfileDialogOpen(true);
  };

  const handleDelete = () => {
    if (
      confirm(`Are you sure you want to delete "${profile.name}"? This action cannot be undone.`)
    ) {
      deleteProfile.mutate(profile.id);
    }
  };

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => setDetailOpen(true)}
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              {profile.name}
            </span>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" onClick={handleEdit} aria-label="Edit profile">
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={deleteProfile.isPending}
                aria-label="Delete profile"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profile.description && (
            <p className="text-sm text-muted-foreground mb-2">{profile.description}</p>
          )}
          <div className="flex gap-2 mb-2">
            <Badge variant="outline">{profile.language}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Created {formatDate(profile.created_at)}</p>
        </CardContent>
      </Card>

      <ProfileDetail profileId={profile.id} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}
