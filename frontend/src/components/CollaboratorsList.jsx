'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Users,
  Crown,
  Trash2,
  Loader2,
  UserPlus,
  Plus
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { InviteCollaboratorForm } from '@/components/InviteCollaboratorForm';

/**
 * Component to display and manage project collaborators
 */
export function CollaboratorsList({ projectId, projectName, isOwner }) {
  const { data: session } = useSession();
  const [collaborators, setCollaborators] = useState([]);
  const [owner, setOwner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [removingUsername, setRemovingUsername] = useState(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const fetchCollaborators = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/collaborators`);
      const data = await response.json();

      if (data.success) {
        setOwner(data.owner);
        setCollaborators(data.collaborators);
      }
    } catch (error) {
      console.error('Error fetching collaborators:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  const handleRemove = async (username) => {
    setRemovingUsername(username);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/collaborators?username=${encodeURIComponent(username)}`,
        { method: 'DELETE' }
      );
      const data = await response.json();

      if (data.success) {
        setCollaborators(prev => prev.filter(c => c.username !== username));
      }
    } catch (error) {
      console.error('Error removing collaborator:', error);
    } finally {
      setRemovingUsername(null);
    }
  };

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'editor':
        return 'secondary';
      case 'viewer':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Inline form when no collaborators exist */}
      {isOwner && collaborators.length === 0 && (
        <InviteCollaboratorForm
          projectId={projectId}
          onInviteSuccess={(newMember) => {
            setCollaborators(prev => [...prev, { ...newMember, addedAt: new Date().toISOString() }]);
          }}
        />
      )
      }

      <Card>
        <CardHeader className="pb-3 border-b mb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Team Members
            </CardTitle>

            {/* Dialog form when collaborators already exist */}
            {isOwner && collaborators.length > 0 && (
              <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 gap-2 rounded-xl">
                    <UserPlus className="h-4 w-4" />
                    <span>Add Member</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                  </DialogHeader>
                  <InviteCollaboratorForm
                    projectId={projectId}
                    onInviteSuccess={(newMember) => {
                      setCollaborators(prev => [...prev, { ...newMember, addedAt: new Date().toISOString() }]);
                      setIsInviteDialogOpen(false);
                    }}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Owner */}
          {owner && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://github.com/${owner.username}.png`} />
                  <AvatarFallback>{owner.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{owner.username}</p>
                  <p className="text-xs text-muted-foreground">Project Owner</p>
                </div>
              </div>
              <Badge variant="default" className="gap-1">
                <Crown className="h-3 w-3" />
                Owner
              </Badge>
            </div>
          )}

          {/* Collaborators */}
          {collaborators.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No collaborators yet. {isOwner && 'Invite team members to collaborate.'}
            </p>
          ) : (
            collaborators.map((collaborator) => (
              <div
                key={collaborator.username}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`https://github.com/${collaborator.username}.png`} />
                    <AvatarFallback>{collaborator.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{collaborator.username}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(collaborator.addedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getRoleBadgeVariant(collaborator.role)} className="capitalize">
                    {collaborator.role}
                  </Badge>
                  {isOwner && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={removingUsername === collaborator.username}
                        >
                          {removingUsername === collaborator.username ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Collaborator</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove <strong>{collaborator.username}</strong> from this project?
                            They will lose access to all project reports.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemove(collaborator.username)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CollaboratorsList;
