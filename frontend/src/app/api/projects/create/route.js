import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Project, Report, Template } from '@/lib/models';
import crypto from 'crypto';

// Fallback templates (same as in /api/templates)
const fallbackTemplates = [
  {
    id: 'IEEE_SRS_V1',
    templateId: 'IEEE_SRS_V1',
    name: 'IEEE Software Requirements Specification',
    standard: 'IEEE-830',
    version: '1.0',
    description: 'Based on IEEE 830 standard for documenting software requirements.',
    sections: [
      { id: 'introduction', number: '1', title: 'Introduction', level: 1, required: true },
      { id: 'purpose', number: '1.1', title: 'Purpose', level: 2, required: true },
      { id: 'scope', number: '1.2', title: 'Scope', level: 2, required: true },
      { id: 'overall-description', number: '2', title: 'Overall Description', level: 1, required: true },
      { id: 'specific-requirements', number: '3', title: 'Specific Requirements', level: 1, required: true },
      { id: 'implementation', number: '4', title: 'Implementation Details', level: 1, required: true },
    ]
  },
  {
    id: 'IEEE_SDD_V1',
    templateId: 'IEEE_SDD_V1',
    name: 'IEEE Software Design Description',
    standard: 'IEEE-1016',
    version: '1.0',
    description: 'Based on IEEE 1016 standard for software design documentation.',
    sections: [
      { id: 'introduction', number: '1', title: 'Introduction', level: 1, required: true },
      { id: 'design-overview', number: '2', title: 'Design Overview', level: 1, required: true },
      { id: 'system-architecture', number: '3', title: 'System Architecture', level: 1, required: true },
      { id: 'data-design', number: '4', title: 'Data Design', level: 1, required: true },
    ]
  },
  {
    id: 'AGILE_LOG_V1',
    templateId: 'AGILE_LOG_V1',
    name: 'Agile Sprint Log',
    standard: 'AGILE',
    version: '1.0',
    description: 'Lightweight template for tracking sprint progress.',
    sections: [
      { id: 'sprint-overview', number: '1', title: 'Sprint Overview', level: 1, required: true },
      { id: 'completed-work', number: '2', title: 'Completed Work', level: 1, required: true },
      { id: 'technical-notes', number: '3', title: 'Technical Notes', level: 1, required: false },
    ]
  }
];

/**
 * POST /api/projects/create
 * Creates a new project with initial report
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      repoUrl,
      repoFullName,
      repoOwner,
      repoName,
      templateId,
      settings = {}
    } = body;

    // Validate required fields
    if (!name || !repoUrl || !repoFullName || !templateId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, repoUrl, repoFullName, templateId' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if project already exists for this repo
    const existingProject = await Project.findOne({ repoFullName });
    if (existingProject) {
      return NextResponse.json(
        { 
          error: 'A project already exists for this repository',
          existingProjectId: existingProject._id.toString()
        },
        { status: 409 }
      );
    }

    // Try to find template in database first
    let template = await Template.findOne({ 
      templateId,
      $or: [{ isActive: true }, { isActive: { $exists: false } }]
    });
    
    // If not found in DB, check fallback templates
    if (!template) {
      const fallbackTemplate = fallbackTemplates.find(t => t.id === templateId || t.templateId === templateId);
      if (fallbackTemplate) {
        console.log(`[CreateProject] Using fallback template: ${templateId}`);
        template = fallbackTemplate;
      }
    }
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Create the project
    const project = new Project({
      name,
      repoUrl,
      repoFullName,
      owner: session.user?.id || null,
      activeTemplateId: templateId,
      webhookSecret,
      settings: {
        autoProcess: settings.autoProcess !== false,
        ignoredPaths: settings.ignoredPaths || [
          'node_modules/**',
          'package-lock.json',
          'pnpm-lock.yaml',
          'yarn.lock',
          '.git/**',
          'dist/**',
          'build/**',
          '*.min.js',
          '*.min.css'
        ],
        techStack: settings.techStack || []
      },
      status: 'active'
    });

    await project.save();

    // Create initial report with template sections
    const initialSections = template.sections.map(section => ({
      id: crypto.randomUUID(),
      templateSectionId: section.id,
      title: section.title,
      number: section.number,
      content: '',
      lastUpdated: new Date(),
      aiLastTouched: false,
      wordCount: 0,
      contributions: []
    }));

    const report = new Report({
      projectId: project._id,
      templateId: templateId,
      title: `${name} - Project Report`,
      status: 'draft',
      sections: initialSections,
      metadata: {
        totalWordCount: 0,
        lastAIUpdate: null,
        version: 1
      }
    });

    await report.save();

    // Setup GitHub webhook
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    const webhookUrl = `${backendUrl}/webhooks/github`;
    
    let webhookSetup = { success: false, message: 'Webhook URL not configured' };
    
    if (backendUrl && repoOwner && repoName) {
      try {
        const webhookResponse = await fetch(
          `https://api.github.com/repos/${repoOwner}/${repoName}/hooks`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${session.accessToken}`,
              'X-GitHub-Api-Version': '2022-11-28'
            },
            body: JSON.stringify({
              name: 'web',
              active: true,
              events: ['push'],
              config: {
                url: webhookUrl,
                content_type: 'json',
                secret: webhookSecret,
                insecure_ssl: '0'
              }
            })
          }
        );

        if (webhookResponse.ok) {
          const webhookData = await webhookResponse.json();
          webhookSetup = { 
            success: true, 
            webhookId: webhookData.id,
            message: 'Webhook created successfully' 
          };
        } else {
          const errorData = await webhookResponse.json();
          // Check if webhook already exists
          if (webhookResponse.status === 422 && 
              errorData.errors?.some(e => e.message?.includes('already exists'))) {
            webhookSetup = { 
              success: true, 
              message: 'Webhook already exists' 
            };
          } else {
            webhookSetup = { 
              success: false, 
              message: errorData.message || 'Failed to create webhook',
              requiresManualSetup: true
            };
          }
        }
      } catch (webhookError) {
        console.error('Webhook setup error:', webhookError);
        webhookSetup = { 
          success: false, 
          message: 'Failed to setup webhook',
          requiresManualSetup: true
        };
      }
    }

    console.log(`[CreateProject] Created project: ${name} (${repoFullName})`);

    return NextResponse.json({
      success: true,
      project: {
        id: project._id.toString(),
        name: project.name,
        repoUrl: project.repoUrl,
        repoFullName: project.repoFullName,
        templateId: project.activeTemplateId,
        status: project.status,
        createdAt: project.createdAt
      },
      report: {
        id: report._id.toString(),
        title: report.title,
        status: report.status,
        sectionsCount: report.sections.length
      },
      webhook: webhookSetup,
      webhookUrl
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating project:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'A project already exists for this repository' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
