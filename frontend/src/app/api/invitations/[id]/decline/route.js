import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Invitation } from '@/lib/models';

/**
 * POST /api/invitations/[id]/decline
 * Decline an invitation
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const username = session.user?.name;

    if (!username) {
      return NextResponse.json(
        { error: 'Username not found in session' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find the invitation
    const invitation = await Invitation.findById(id);
    
    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Check if the invitation is for this user
    if (invitation.inviteeUsername.toLowerCase() !== username.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation is not for you' },
        { status: 403 }
      );
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation has already been ${invitation.status}` },
        { status: 400 }
      );
    }

    // Update invitation status
    invitation.status = 'declined';
    invitation.respondedAt = new Date();
    await invitation.save();

    return NextResponse.json({
      success: true,
      message: 'Invitation declined'
    });

  } catch (error) {
    console.error('[Invitation] Error declining invitation:', error);
    return NextResponse.json(
      { error: 'Failed to decline invitation' },
      { status: 500 }
    );
  }
}
