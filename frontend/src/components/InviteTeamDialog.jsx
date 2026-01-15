'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
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
  CheckCircle2,
  AlertCircle,
  Send
} from 'lucide-react';

/**
 * Dialog for inviting team members to a project
 */
export function InviteTeamDialog({ projectId, projectName, trigger }) {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('editor');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  const resetForm = () => {
    setUsername('');
    setRole('editor');
    setMessage('');
    setResult(null);
  };

  const handleOpenChange = (open) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleSendInvite = async () => {
    if (!username.trim()) {
      setResult({ success: false, error: 'Please enter a GitHub username' });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          inviteeUsername: username.trim(),
          role,
          message: message.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: `Invitation sent to ${username}!`,
        });
        setUsername('');
        setMessage('');
      } else {
        setResult({
          success: false,
          error: data.error || 'Failed to send invitation',
        });
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      setResult({
        success: false,
        error: 'Failed to send invitation. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Invite Team
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Invite a collaborator to &quot;{projectName}&quot;. They&apos;ll receive an invitation 
            they can accept or decline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Username input */}
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              GitHub Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter GitHub username"
              className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              disabled={isLoading}
            />
          </div>

          {/* Role selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <Select value={role} onValueChange={setRole} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer - Can view reports</SelectItem>
                <SelectItem value="editor">Editor - Can view and edit reports</SelectItem>
                <SelectItem value="admin">Admin - Full access</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Optional message */}
          <div className="space-y-2">
            <label htmlFor="message" className="text-sm font-medium">
              Message (optional)
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message..."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Result message */}
          {result && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                result.success
                  ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
              )}
              {result.success ? result.message : result.error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
          <Button onClick={handleSendInvite} disabled={isLoading || !username.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InviteTeamDialog;
