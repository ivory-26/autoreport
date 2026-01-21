'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Github, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { motion } from "motion/react";
import Link from 'next/link';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const errorParam = searchParams.get('error');

  // If already authenticated, redirect to callback URL
  useEffect(() => {
    if (status === 'authenticated') {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  const errorMessageFromParam = useMemo(() => {
    if (!errorParam) {
      return null;
    }

    const errorMessages = {
      'OAuthSignin': 'Error starting OAuth sign in flow',
      'OAuthCallback': 'Error handling OAuth callback',
      'OAuthCreateAccount': 'Could not create OAuth account',
      'EmailCreateAccount': 'Could not create email account',
      'Callback': 'Error in authentication callback',
      'OAuthAccountNotLinked': 'This account is already linked to another user',
      'EmailSignin': 'Check your email for a sign-in link',
      'CredentialsSignin': 'Sign in failed. Check the details you provided.',
      'SessionRequired': 'Please sign in to access this page',
      'Default': 'An error occurred during authentication',
    };

    return errorMessages[errorParam] || errorMessages['Default'];
  }, [errorParam]);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // For returning users, we use the default provider (github with full access)
      // Their existing preference is stored in the database and will be respected
      const result = await signIn('github', {
        callbackUrl,
        redirect: true // Let NextAuth handle redirect
      });

      // If we get here and there's an error
      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  // Show loading spinner while checking session
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render if already authenticated (will redirect)
  if (status === 'authenticated') {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/10 px-4 py-12">
      {/* Background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px] opacity-20" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[128px] opacity-20" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-2 shadow-xl">
          <CardHeader className="space-y-1 text-center pb-8">
            <div className="flex justify-center mb-4">
              <div className="h-16 px-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  AutoReport
                </span>
              </div>
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-base">
              Sign in to continue to your dashboard
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {(error || errorMessageFromParam) && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error || errorMessageFromParam}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full h-auto py-6 px-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
              variant="default"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-6 w-6 mr-3 animate-spin" />
                  <span>Signing you in...</span>
                </>
              ) : (
                <>
                  <Github className="h-6 w-6 mr-3" />
                  <span>Continue with GitHub</span>
                </>
              )}
            </Button>

            <div className="pt-2">
              <p className="text-xs text-center text-muted-foreground">
                💡 <strong>Tip:</strong> To switch GitHub accounts,{' '}
                <a
                  href="https://github.com/logout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  sign out from GitHub
                </a>{' '}
                first.
              </p>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  New to AutoReport?
                </span>
              </div>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account yet?
              </p>
              <Link href="/auth/signup">
                <Button variant="ghost" className="w-full group">
                  Create an account
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-center text-muted-foreground">
                By continuing, you agree to our{' '}
                <Link href="/terms" className="underline hover:text-foreground">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="underline hover:text-foreground">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              ← Back to home
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
