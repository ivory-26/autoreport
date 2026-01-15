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

    const { id: projectId, sectionId } = await params;
    
    // Get the backend URL
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

    // Call the backend revert endpoint
    const response = await fetch(
      `${backendUrl}/api/projects/${projectId}/sections/${sectionId}/revert`,
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
        { error: data.error || 'Failed to revert section' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reverting section:', error);
    return NextResponse.json(
      { error: 'Failed to revert section' },
      { status: 500 }
    );
  }
}
