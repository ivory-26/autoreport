import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-9 w-48 bg-muted animate-pulse rounded-md" />
          <div className="h-5 w-64 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="h-10 w-32 bg-muted animate-pulse rounded-md" />
      </div>

      {/* Loading Spinner */}
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-lg font-medium">Loading your dashboard...</p>
          <p className="text-sm text-muted-foreground mt-1">
            Fetching your projects and reports
          </p>
        </div>
      </div>
    </div>
  );
}
