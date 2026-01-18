import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';

/**
 * GET /api/user/preferences
 * Fetches user preferences based on GitHub username or email
 * Used to auto-select OAuth provider on signin/signup pages
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const identifier = searchParams.get('identifier'); // Can be username or email
    
    if (!identifier) {
      return NextResponse.json(
        { error: 'Identifier (username or email) is required' },
        { status: 400 }
      );
    }

    await dbConnect();
    
    // Try to find user by username or email
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier }
      ]
    }).select('preferredProvider username');

    if (!user) {
      return NextResponse.json(
        { exists: false },
        { status: 200 }
      );
    }

    return NextResponse.json({
      exists: true,
      preferredProvider: user.preferredProvider || 'github',
      username: user.username
    });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
