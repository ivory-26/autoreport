'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, LogIn, Home } from 'lucide-react';
import Link from 'next/link';

export default function AuthError({ error, reset }) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error('Authentication error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/10 px-4 py-12">
      {/* Background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-[128px] opacity-20" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-[128px] opacity-20" />
      </div>

      <Card className="w-full max-w-md border-2 shadow-xl">
        <CardHeader className="space-y-1 text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Authentication Error
          </CardTitle>
          <CardDescription className="text-base">
            There was a problem signing you in. Please try again.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error details (only show in development) */}
          {process.env.NODE_ENV === 'development' && error?.message && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all">
                {error.message}
              </p>
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

            <Link href="/auth/signin" className="w-full">
              <Button variant="outline" className="w-full">
                <LogIn className="h-4 w-4 mr-2" />
                Back to Sign In
              </Button>
            </Link>

            <Link href="/" className="w-full">
              <Button variant="ghost" className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Go to home
              </Button>
            </Link>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              <strong>Common fixes:</strong>
            </p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
              <li>Make sure you're logged into GitHub</li>
              <li>Try clearing your browser cookies</li>
              <li>Use a different browser or incognito mode</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
