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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

/**
 * Component to display pending invitations for the current user
 */
export function PendingInvitations() {
  const router = useRouter();
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
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
        setReceived(data.received || []);
        setSent(data.sent || []);
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
        setReceived(prev => prev.filter(inv => inv.id !== invitationId));
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
        setReceived(prev => prev.filter(inv => inv.id !== invitationId));
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return null;
  }

  // Hide if no activities either way
  if (received.length === 0 && sent.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">
            Invitations
          </h3>
        </div>

        <Tabs defaultValue="received" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 h-8 bg-blue-100/50 dark:bg-blue-900/20">
            <TabsTrigger value="received" className="text-xs">
              Received ({received.length})
            </TabsTrigger>
            <TabsTrigger value="sent" className="text-xs">
              Sent ({sent.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="space-y-3 mt-0">
            {received.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No received invitations</p>
            ) : (
              received.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white dark:bg-zinc-900 border shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium truncate">{invitation.projectName}</span>
                      <Badge variant="outline" className="text-xs capitalize">{invitation.role}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>From: {invitation.invitedBy}</span>
                      <span>•</span>
                      <Clock className="h-3 w-3" />
                      <span>Expires {new Date(invitation.expiresAt).toLocaleDateString()}</span>
                    </div>
                    {invitation.message && (
                      <p className="text-xs text-muted-foreground mt-1 italic">&quot;{invitation.message}&quot;</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDecline(invitation.id)}
                      disabled={processingId === invitation.id}
                      className="h-7 w-7 p-0"
                    >
                      {processingId === invitation.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAccept(invitation.id)}
                      disabled={processingId === invitation.id}
                      className="bg-blue-600 hover:bg-blue-700 h-7 text-xs"
                    >
                      {processingId === invitation.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" /> Accept</>}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="sent" className="space-y-3 mt-0">
            {sent.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No active sent invitations</p>
            ) : (
              sent.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white/50 dark:bg-zinc-900/50 border border-dashed"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium truncate">{invitation.projectName}</span>
                      <Badge variant="secondary" className="text-xs capitalize">{invitation.role}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>To: @{invitation.inviteeUsername}</span>
                      <span>•</span>
                      <span className="text-orange-500 text-[10px] uppercase font-bold tracking-wider">Pending</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default PendingInvitations;
