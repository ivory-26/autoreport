'use client';

/**
 * DashboardTabs Component
 * 
 * Tab navigation uses sliding bubble animation inspired by Raul Dronca
 * Implementation based on Wes Bos's CodePen - MIT License
 * See @/components/ui/reports-page-tabs for full license text
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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

  // Animation state
  const [activeRect, setActiveRect] = useState(null);
  const [hoverRect, setHoverRect] = useState(null);
  const containerRef = useRef(null);

  const updateActiveRect = useCallback(() => {
    if (!containerRef.current) return;
    const activeButton = containerRef.current.querySelector('[data-active="true"]');
    if (activeButton) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      setActiveRect({
        left: buttonRect.left - containerRect.left,
        top: buttonRect.top - containerRect.top,
        width: buttonRect.width,
        height: buttonRect.height,
      });
    }
  }, []);

  useEffect(() => {
    updateActiveRect();
    window.addEventListener('resize', updateActiveRect);
    return () => window.removeEventListener('resize', updateActiveRect);
  }, [updateActiveRect, activeTab]);

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

  const handleMouseEnter = (e) => {
    const button = e.currentTarget;
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      setHoverRect({
        left: buttonRect.left - containerRect.left,
        top: buttonRect.top - containerRect.top,
        width: buttonRect.width,
        height: buttonRect.height,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoverRect(null);
  };

  return (
    <div className="space-y-6">
      {/* Premium Tabs with Sliding Bubble */}
      <div className="relative w-fit">

        <div
          ref={containerRef}
          className={cn(
            'relative inline-flex items-center p-1 rounded-full',
            'bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950',
            'border border-zinc-200 dark:border-zinc-800',
            'shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_8px_rgba(0,0,0,0.4)]'
          )}
        >
          {/* Hover bubble */}
          {hoverRect && (
            <motion.div
              className="absolute rounded-full bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 dark:border-blue-400/20 shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
              initial={false}
              animate={{
                left: hoverRect.left,
                top: hoverRect.top,
                width: hoverRect.width,
                height: hoverRect.height,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{ zIndex: 1 }}
            />
          )}

          {/* Active bubble */}
          {activeRect && (
            <motion.div
              className="absolute rounded-full bg-gradient-to-b from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 shadow-[0_2px_8px_rgba(37,99,235,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)]"
              initial={false}
              animate={{
                left: activeRect.left,
                top: activeRect.top,
                width: activeRect.width,
                height: activeRect.height,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{ zIndex: 2 }}
            />
          )}

          <button
            data-active={activeTab === 'projects'}
            onClick={() => setActiveTab('projects')}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
              'relative z-10 inline-flex items-center justify-center gap-2',
              'px-6 py-2.5 rounded-full',
              'text-sm font-medium whitespace-nowrap',
              'transition-all duration-300',
              activeTab === 'projects'
                ? 'text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400'
            )}
          >
            <FolderKanban className="h-4 w-4" />
            Projects
          </button>

          <button
            data-active={activeTab === 'invitations'}
            onClick={() => setActiveTab('invitations')}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
              'relative z-10 inline-flex items-center justify-center gap-2',
              'px-6 py-2.5 rounded-full',
              'text-sm font-medium whitespace-nowrap',
              'transition-all duration-300',
              activeTab === 'invitations'
                ? 'text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400'
            )}
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
