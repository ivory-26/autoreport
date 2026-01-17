'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UserPlus,
  Loader2,
  Send
} from 'lucide-react';

export function InviteCollaboratorForm({ projectId, onInviteSuccess }) {
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [invitedMembers, setInvitedMembers] = useState([]);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);

  const handleInvite = async () => {
    if (!inviteUsername.trim() || !projectId) return;

    setIsInviting(true);
    setInviteError(null);

    try {
      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          inviteeUsername: inviteUsername.trim(),
          role: inviteRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      const newMember = { username: inviteUsername.trim(), role: inviteRole };
      setInvitedMembers(prev => [...prev, newMember]);
      setInviteUsername('');

      if (onInviteSuccess) {
        onInviteSuccess(newMember);
      }
    } catch (error) {
      setInviteError(error.message);
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-purple-600" />
          <p className="font-medium text-purple-600 dark:text-purple-400">
            Invite Team Members
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Add collaborators to your project. They&apos;ll receive an invitation to accept.
        </p>

        {/* Invite Form */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inviteUsername}
            onChange={(e) => setInviteUsername(e.target.value)}
            placeholder="GitHub username"
            className="flex-1 px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
          />
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleInvite}
            disabled={!inviteUsername.trim() || isInviting}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isInviting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {inviteError && (
          <p className="text-sm text-destructive">{inviteError}</p>
        )}

        {/* Invited Members List */}
        {invitedMembers.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground">Invitations sent:</p>
            <div className="flex flex-wrap gap-2">
              {invitedMembers.map((member, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  @{member.username}
                  <span className="text-xs opacity-60">({member.role})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
