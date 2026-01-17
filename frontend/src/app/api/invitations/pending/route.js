import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Invitation } from '@/lib/models';

/**
 * GET /api/invitations/pending
 * Get pending invitations for the current user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const username = session.user?.githubUsername || session.user?.name;
    if (!username) {
      return NextResponse.json(
        { error: 'Username not found in session' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find pending invitations received by this user
    const received = await Invitation.find({
      inviteeUsername: { $regex: new RegExp(`^${username}$`, 'i') },
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).lean();

    // Find pending invitations sent by this user
    const sent = await Invitation.find({
      'invitedBy.username': { $regex: new RegExp(`^${username}$`, 'i') },
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).lean();

    const mapInvitation = (inv) => ({
      id: inv._id.toString(),
      projectId: inv.projectId.toString(),
      projectName: inv.projectName,
      invitedBy: inv.invitedBy.username,
      inviteeUsername: inv.inviteeUsername,
      role: inv.role,
      message: inv.message,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
      status: inv.status
    });

    return NextResponse.json({
      success: true,
      received: received.map(mapInvitation),
      sent: sent.map(mapInvitation),
      // Backwards compatibility if needed, though we will update frontend
      invitations: received.map(mapInvitation)
    });

  } catch (error) {
    console.error('[Invitation] Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}
