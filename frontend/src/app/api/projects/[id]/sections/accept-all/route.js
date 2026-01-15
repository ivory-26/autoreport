import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    
    // Get the backend URL
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

    // Call the backend accept-all endpoint
    const response = await fetch(
      `${backendUrl}/api/projects/${projectId}/sections/accept-all`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to accept all sections' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error accepting all sections:', error);
    return NextResponse.json(
      { error: 'Failed to accept all sections' },
      { status: 500 }
    );
  }
}
