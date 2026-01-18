import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8 animate-in fade-in duration-500">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-64 rounded-lg" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex items-center gap-3 ml-14">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-4 w-48 rounded-md" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
        </div>
        <div className="flex gap-3 md:ml-0 ml-14">
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-6 border-b pb-1 overflow-x-auto no-scrollbar">
        <Skeleton className="h-8 w-28 rounded-t-lg" />
        <Skeleton className="h-8 w-28 rounded-t-lg" />
        <Skeleton className="h-8 w-28 rounded-t-lg" />
        <Skeleton className="h-8 w-28 rounded-t-lg" />
      </div>

      {/* Main Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Report Viewer Skeleton */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-none shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
            <CardHeader className="space-y-4 pb-0">
              <Skeleton className="h-10 w-2/3 rounded-lg" />
              <div className="flex gap-4">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-32 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-7 w-48 rounded-md" />
                  </div>
                  <div className="space-y-3 pl-0">
                    <Skeleton className="h-4 w-full rounded-full" />
                    <Skeleton className="h-4 w-[95%] rounded-full" />
                    <Skeleton className="h-4 w-[90%] rounded-full" />
                    <Skeleton className="h-4 w-[98%] rounded-full" />
                  </div>
                  {i === 1 && (
                    <div className="grid grid-cols-2 gap-4 pt-2">
                       <Skeleton className="h-32 w-full rounded-xl" />
                       <Skeleton className="h-32 w-full rounded-xl" />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Skeleton */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-card/50">
            <CardHeader className="pb-3 border-b">
              <Skeleton className="h-5 w-24 rounded-md" />
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <Skeleton className="h-4 w-20 rounded-sm" />
                  <Skeleton className="h-4 w-12 rounded-sm" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card/50">
            <CardHeader className="pb-3 border-b">
              <Skeleton className="h-5 w-32 rounded-md" />
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-16 rounded-sm" />
                      <Skeleton className="h-2 w-12 rounded-sm" />
                    </div>
                  </div>
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

