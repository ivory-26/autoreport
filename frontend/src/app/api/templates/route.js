import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Template } from '@/lib/models';

// Fallback templates if none are in the database
const fallbackTemplates = [
  {
    id: 'IEEE_SRS_V1',
    name: 'IEEE Software Requirements Specification',
    standard: 'IEEE-830',
    version: '1.0',
    description: 'Based on IEEE 830 standard for documenting software requirements. Ideal for academic projects and formal documentation.',
    metadata: { targetAudience: 'academic', language: 'en' },
    sectionsCount: 15,
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
    name: 'IEEE Software Design Description',
    standard: 'IEEE-1016',
    version: '1.0',
    description: 'Based on IEEE 1016 standard for software design documentation. Focus on architecture and design decisions.',
    metadata: { targetAudience: 'professional', language: 'en' },
    sectionsCount: 12,
    sections: [
      { id: 'introduction', number: '1', title: 'Introduction', level: 1, required: true },
      { id: 'design-overview', number: '2', title: 'Design Overview', level: 1, required: true },
      { id: 'system-architecture', number: '3', title: 'System Architecture', level: 1, required: true },
      { id: 'data-design', number: '4', title: 'Data Design', level: 1, required: true },
    ]
  },
  {
    id: 'AGILE_LOG_V1',
    name: 'Agile Sprint Log',
    standard: 'AGILE',
    version: '1.0',
    description: 'Lightweight template for tracking sprint progress. Perfect for agile teams and quick project updates.',
    metadata: { targetAudience: 'internal', language: 'en' },
    sectionsCount: 8,
    sections: [
      { id: 'sprint-overview', number: '1', title: 'Sprint Overview', level: 1, required: true },
      { id: 'completed-work', number: '2', title: 'Completed Work', level: 1, required: true },
      { id: 'technical-notes', number: '3', title: 'Technical Notes', level: 1, required: false },
    ]
  }
];

/**
 * GET /api/templates
 * Fetches all available report templates
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

    await dbConnect();

    // Fetch all templates (isActive defaults to true, also include templates without isActive field)
    const templates = await Template.find({ 
      $or: [
        { isActive: true }, 
        { isActive: { $exists: false } }
      ] 
    })
      .select('templateId name standard version description metadata sections isActive')
      .lean();

    console.log(`[Templates API] Found ${templates.length} templates in database`);

    // If no templates in database, use fallback templates
    if (templates.length === 0) {
      console.log('[Templates API] No templates in DB, using fallback templates');
      return NextResponse.json({
        success: true,
        templates: fallbackTemplates,
        source: 'fallback'
      });
    }

    // Transform to simpler format for frontend
    const templatesForFrontend = templates.map(t => ({
      id: t.templateId,
      name: t.name,
      standard: t.standard,
      version: t.version,
      description: t.description,
      metadata: t.metadata,
      sectionsCount: t.sections?.length || 0,
      sections: t.sections?.map(s => ({
        id: s.id,
        number: s.number,
        title: s.title,
        level: s.level,
        required: s.required
      })) || []
    }));

    return NextResponse.json({
      success: true,
      templates: templatesForFrontend,
      source: 'database'
    });
  } catch (error) {
    console.error('[Templates API] Error fetching templates:', error);
    
    // On error, still return fallback templates so wizard works
    console.log('[Templates API] Error occurred, returning fallback templates');
    return NextResponse.json({
      success: true,
      templates: fallbackTemplates,
      source: 'fallback-error'
    });
  }
}
