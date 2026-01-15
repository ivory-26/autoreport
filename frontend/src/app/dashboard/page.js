import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Project, Report } from '@/lib/models';
import { ProjectCard } from '@/components/ProjectCard';
import { NewProjectButton } from '@/components/NewProjectButton';
import { EmptyProjectsState } from '@/components/EmptyProjectsState';
import { DashboardTabs } from '@/components/DashboardTabs';

/**
 * Get projects owned by the current user
 */
async function getOwnedProjects(username) {
  await dbConnect();
  
  const projects = await Project.find({ 
    status: 'active',
    ownerUsername: { $regex: new RegExp(`^${username}$`, 'i') }
  })
    .sort({ updatedAt: -1 })
    .lean();

  return enrichProjectsWithReports(projects);
}

/**
 * Get projects where the user is a collaborator
 */
async function getSharedProjects(username) {
  await dbConnect();
  
  const projects = await Project.find({ 
    status: 'active',
    'collaborators.username': { $regex: new RegExp(`^${username}$`, 'i') }
  })
    .sort({ updatedAt: -1 })
    .lean();

  return enrichProjectsWithReports(projects, true);
}

/**
 * Enrich projects with their report data
 */
async function enrichProjectsWithReports(projects, isShared = false) {
  const projectsWithReports = await Promise.all(
    projects.map(async (project) => {
      const report = await Report.findOne({ projectId: project._id })
        .select('title status metadata updatedAt _id projectId')
        .lean();
      
      return {
        ...project,
        _id: project._id.toString(),
        isShared,
        report: report ? {
          ...report,
          _id: report._id?.toString() || '',
          projectId: report.projectId?.toString() || project._id.toString(),
        } : null,
      };
    })
  );

  return projectsWithReports;
}

function getStatusColor(status) {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'in-progress':
      return 'default';
    case 'review':
      return 'outline';
    case 'final':
      return 'default';
    default:
      return 'secondary';
  }
}

function formatDate(date) {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/api/auth/signin');
  }

  // Use (preferred) githubUsername or fallback to name
  const username = session.user?.githubUsername || session.user?.name;
  const [ownedProjects, sharedProjects] = await Promise.all([
    getOwnedProjects(username),
    getSharedProjects(username)
  ]);

  const allProjects = [...ownedProjects, ...sharedProjects].sort((a, b) => {
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Your projects and auto-generated reports
          </p>
        </div>
        <NewProjectButton />
      </div>

      {/* Tabs: Projects | Invitations */}
      <DashboardTabs>
        {/* Projects Grid */}
        {allProjects.length === 0 ? (
          <EmptyProjectsState />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {allProjects.map((project) => (
              <ProjectCard 
                key={project._id} 
                project={project} 
                statusColor={getStatusColor(project.report?.status)}
                formattedDate={formatDate(project.report?.updatedAt)}
                isShared={project.isShared}
              />
            ))}
          </div>
        )}
      </DashboardTabs>
    </div>
  );
}
