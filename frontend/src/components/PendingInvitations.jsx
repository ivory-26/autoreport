'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Check, 
  X, 
  Loader2,
  Users,
  Clock
} from 'lucide-react';

/**
 * Component to display pending invitations for the current user
 */
export function PendingInvitations() {
  const router = useRouter();
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const response = await fetch('/api/invitations/pending');
      const data = await response.json();
      
      if (data.success) {
        setInvitations(data.invitations);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (invitationId) => {
    setProcessingId(invitationId);
    try {
      const response = await fetch(`/api/invitations/${invitationId}/accept`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        // Remove from list and refresh
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
        router.refresh();
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId) => {
    setProcessingId(invitationId);
    try {
      const response = await fetch(`/api/invitations/${invitationId}/decline`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return null; // Don't show anything while loading
  }

  if (invitations.length === 0) {
    return null; // Don't show anything if no invitations
  }

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">
            Pending Invitations
          </h3>
          <Badge variant="secondary" className="ml-auto">
            {invitations.length}
          </Badge>
        </div>
        
        <div className="space-y-3">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white dark:bg-zinc-900 border"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium truncate">
                    {invitation.projectName}
                  </span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {invitation.role}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>Invited by {invitation.invitedBy}</span>
                  <span>•</span>
                  <Clock className="h-3 w-3" />
                  <span>
                    Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                {invitation.message && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    &quot;{invitation.message}&quot;
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDecline(invitation.id)}
                  disabled={processingId === invitation.id}
                >
                  {processingId === invitation.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAccept(invitation.id)}
                  disabled={processingId === invitation.id}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {processingId === invitation.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default PendingInvitations;
