import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProfile } from '@/lib/hooks/useProfiles';
import { formatDate } from '@/lib/utils/format';
import { SampleList } from './SampleList';

interface ProfileDetailProps {
  profileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDetail({ profileId, open, onOpenChange }: ProfileDetailProps) {
  const { data: profile, isLoading } = useProfile(profileId);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="text-muted-foreground">Loading profile...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile.name}</DialogTitle>
          <DialogDescription>Manage samples and view profile details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {profile.description && (
            <div>
              <h3 className="text-sm font-medium mb-1">Description</h3>
              <p className="text-sm text-muted-foreground">{profile.description}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Badge variant="outline">{profile.language}</Badge>
            <span className="text-xs text-muted-foreground">
              Created {formatDate(profile.created_at)}
            </span>
          </div>

          <div className="border-t pt-4">
            <SampleList profileId={profileId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
