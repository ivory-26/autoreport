'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Home, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Card className="max-w-lg mx-auto border-2 shadow-xl">
        <CardHeader className="space-y-1 text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Dashboard Error
          </CardTitle>
          <CardDescription className="text-base">
            We encountered an issue loading your dashboard. This might be a temporary problem.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error details (only show in development) */}
          {process.env.NODE_ENV === 'development' && error?.message && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs font-mono text-muted-foreground mt-1">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => reset()}
              className="w-full"
              variant="default"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>

            <Link href="/" className="w-full">
              <Button variant="outline" className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Go to home
              </Button>
            </Link>

            <Link href="/auth/signout" className="w-full">
              <Button variant="ghost" className="w-full text-muted-foreground">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out and try again
              </Button>
            </Link>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              If this problem persists, try clearing your browser cookies or using incognito mode.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
