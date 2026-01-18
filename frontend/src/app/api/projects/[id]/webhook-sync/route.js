import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Project } from '@/lib/models';

/**
 * GET /api/projects/[id]/webhook-sync
 * Syncs the project's webhook status with GitHub
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const session = await getServerSession(authOptions);
    
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();
    const project = await Project.findById(id);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Security Check: Only the owner or admins can sync (simplified to anyone with project access for now, but owner is best)
    const isOwner = project.ownerUsername?.toLowerCase() === (session.user?.githubUsername || session.user?.name)?.toLowerCase();
    
    if (!isOwner) {
       return NextResponse.json(
        { error: 'Forbidden - Only the project owner can sync webhook status' },
        { status: 403 }
      );
    }

    // Extract owner and repo from repoFullName (e.g., "owner/repo")
    const [repoOwner, repoName] = project.repoFullName.split('/');

    if (!repoOwner || !repoName) {
      return NextResponse.json(
        { error: 'Invalid repository name' },
        { status: 400 }
      );
    }

    // Define what we're looking for
    const rawBackendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    const backendUrl = rawBackendUrl ? rawBackendUrl.replace(/\/$/, '') : '';
    const targetWebhookUrl = `${backendUrl}/webhooks/github`;

    console.log(`[WebhookSync] Checking webhooks for ${project.repoFullName} looking for ${targetWebhookUrl}`);

    // Fetch webhooks from GitHub
    const webhookResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/hooks`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${session.accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (!webhookResponse.ok) {
      const errorData = await webhookResponse.json();
      return NextResponse.json(
        { 
          error: 'Failed to fetch webhooks from GitHub', 
          details: errorData.message,
          githubStatus: webhookResponse.status
        },
        { status: 502 }
      );
    }

    const webhooks = await webhookResponse.json();
    
    // Look for a webhook matching our URL
    const matchingWebhook = webhooks.find(hook => 
      hook.config && (hook.config.url === targetWebhookUrl || hook.config.url?.endsWith('/webhooks/github'))
    );

    if (matchingWebhook) {
      // Update database status
      project.webhookEnabled = matchingWebhook.active;
      project.webhookId = matchingWebhook.id.toString();
      await project.save();

      return NextResponse.json({
        success: true,
        webhookEnabled: project.webhookEnabled,
        webhookId: project.webhookId,
        message: 'Project status synced with GitHub successfully'
      });
    } else {
      // No matching webhook found, ensure DB reflects this
      const wasEnabled = project.webhookEnabled;
      project.webhookEnabled = false;
      await project.save();

      return NextResponse.json({
        success: true,
        webhookEnabled: false,
        message: 'No matching webhook found on GitHub for this project'
      });
    }

  } catch (error) {
    console.error('Error syncing webhook status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
