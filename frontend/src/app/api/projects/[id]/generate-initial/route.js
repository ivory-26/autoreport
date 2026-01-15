import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/projects/[id]/generate-initial
 * Triggers initial report generation based on the last commit
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const body = await request.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required fields: owner, repo' },
        { status: 400 }
      );
    }

    const rawBackendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    
    if (!rawBackendUrl) {
      return NextResponse.json(
        { error: 'Backend URL not configured' },
        { status: 500 }
      );
    }
    // Remove trailing slash to prevent double slashes in URL
    const backendUrl = rawBackendUrl.replace(/\/$/, '');
    console.log(`[GenerateInitial] Calling backend for project ${projectId}`);

    // Call the backend to generate the initial report
    const response = await fetch(
      `${backendUrl}/api/projects/${projectId}/generate-initial`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accessToken: session.accessToken,
          owner,
          repo
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('[GenerateInitial] Backend error:', data);
      return NextResponse.json(
        { error: data.error || 'Failed to generate initial report' },
        { status: response.status }
      );
    }

    console.log('[GenerateInitial] Success:', data.stats);

    return NextResponse.json({
      success: true,
      ...data
    });

  } catch (error) {
    console.error('[GenerateInitial] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate initial report' },
      { status: 500 }
    );
  }
}
