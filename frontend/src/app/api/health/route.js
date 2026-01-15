import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'AutoReport API is running',
    timestamp: new Date().toISOString(),
    env: {
      hasMongoUri: !!process.env.MONGODB_URI,
      hasGithubClientId: !!process.env.GITHUB_CLIENT_ID,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      nextAuthUrl: process.env.NEXTAUTH_URL,
    },
  });
}
