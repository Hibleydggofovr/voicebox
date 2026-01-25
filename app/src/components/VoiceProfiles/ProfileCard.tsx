import { Edit, Eye, Mic, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CircleButton } from '@/components/ui/circle-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
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
  const selectedProfileId = useUIStore((state) => state.selectedProfileId);
  const setSelectedProfileId = useUIStore((state) => state.setSelectedProfileId);

  const isSelected = selectedProfileId === profile.id;

  const handleSelect = () => {
    setSelectedProfileId(isSelected ? null : profile.id);
  };

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
        className={cn(
          "cursor-pointer hover:shadow-md transition-all",
          isSelected && "ring-2 ring-primary shadow-md"
        )}
        onClick={handleSelect}
      >
        <CardHeader className="p-3 pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-base font-medium">
            <span className="flex items-center gap-1.5 min-w-0 flex-1">
              <Mic className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{profile.name}</span>
            </span>
            <div className="flex gap-0.5 shrink-0">
              <CircleButton
                icon={Eye}
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailOpen(true);
                }}
                aria-label="View details"
              />
              <CircleButton
                icon={Edit}
                onClick={handleEdit}
                aria-label="Edit profile"
              />
              <CircleButton
                icon={Trash2}
                onClick={handleDelete}
                disabled={deleteProfile.isPending}
                aria-label="Delete profile"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <p className="text-xs text-muted-foreground mb-1.5 line-clamp-2 leading-relaxed">
            {profile.description || 'No description'}
          </p>
          <div className="flex items-center justify-between gap-2 mb-1">
            <Badge variant="outline" className="text-xs h-5 px-1.5">
              {profile.language}
            </Badge>
            <p className="text-xs text-muted-foreground/60 text-right">{formatDate(profile.created_at)}</p>
          </div>
        </CardContent>
      </Card>

      <ProfileDetail profileId={profile.id} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}
