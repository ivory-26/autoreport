'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FolderKanban,
  Mail, 
  Check, 
  X, 
  Loader2,
  Users,
  Clock
} from 'lucide-react';

/**
 * Dashboard tabs component for switching between Projects and Invitations
 */
export function DashboardTabs({ children }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('projects');
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

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'projects'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderKanban className="h-4 w-4" />
          Projects
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'invitations'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Mail className="h-4 w-4" />
          Invitations
          {invitations.length > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
              {invitations.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'projects' ? (
        // Render children (projects grid)
        children
      ) : (
        // Invitations tab
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : invitations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Mail className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No pending invitations</h3>
                <p className="text-muted-foreground max-w-sm">
                  When someone invites you to collaborate on a project, it will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <Card key={invitation.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="h-5 w-5 text-blue-600" />
                          <span className="font-semibold text-lg truncate">
                            {invitation.projectName}
                          </span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {invitation.role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Invited by <strong>{invitation.invitedBy}</strong></span>
                          <span>•</span>
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                          </span>
                        </div>
                        {invitation.message && (
                          <p className="text-sm text-muted-foreground mt-2 p-2 rounded bg-muted italic">
                            &quot;{invitation.message}&quot;
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          onClick={() => handleDecline(invitation.id)}
                          disabled={processingId === invitation.id}
                        >
                          {processingId === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <X className="h-4 w-4 mr-1" />
                              Decline
                            </>
                          )}
                        </Button>
                        <Button
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DashboardTabs;
