'use client';

import { useEffect, useState, Suspense } from 'react';
import { signIn, useSession, getProviders } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Github, ArrowRight, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { motion } from "motion/react";
import Link from 'next/link';

const features = [
  'Automatic documentation from Git commits',
  'AI-powered report generation',
  'Multiple export formats (PDF, DOCX)',
  'Team collaboration tools',
  'Custom templates support'
];

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [providers, setProviders] = useState(null);
  const [loadingProviders, setLoadingProviders] = useState(true);

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const errorParam = searchParams.get('error');

  // Fetch available providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await getProviders();
        setProviders(res);
      } catch (err) {
        console.error('Error fetching providers:', err);
        setError('Failed to load authentication options. Please refresh the page.');
      } finally {
        setLoadingProviders(false);
      }
    };
    fetchProviders();
  }, []);

  // If already authenticated, redirect to callback URL
  useEffect(() => {
    if (status === 'authenticated') {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  // Show error if exists
  useEffect(() => {
    if (errorParam) {
      const errorMessages = {
        'OAuthSignin': 'Error starting OAuth sign in flow',
        'OAuthCallback': 'Error handling OAuth callback',
        'OAuthCreateAccount': 'Could not create OAuth account',
        'EmailCreateAccount': 'Could not create email account',
        'Callback': 'Error in authentication callback',
        'OAuthAccountNotLinked': 'This account is already linked to another user',
        'Default': 'An error occurred during sign up',
      };
      setError(errorMessages[errorParam] || errorMessages['Default']);
    }
  }, [errorParam]);

  const handleSignUp = async (providerId) => {
    try {
      setIsLoading(true);
      setError(null);

      // For OAuth, signup and signin are the same flow
      // The database will create or update the user automatically
      const result = await signIn(providerId, {
        callbackUrl,
        redirect: false
      });

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      } else if (result?.url) {
        router.push(result.url);
      }
    } catch (err) {
      console.error('Sign up error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  // Show loading spinner while checking session or loading providers
  if (status === 'loading' || loadingProviders) {
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
        className="w-full max-w-5xl"
      >
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left side - Features */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="hidden md:block space-y-6"
          >
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-2">
                Start your journey with{' '}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  AutoReport
                </span>
              </h1>
              <p className="text-lg text-muted-foreground">
                Zero-click documentation that writes itself while you code
              </p>
            </div>

            <div className="space-y-3">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-1 flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <span className="text-foreground/90">{feature}</span>
                </motion.div>
              ))}
            </div>

            <div className="pt-6 flex items-center gap-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-background bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold"
                  >
                    U{i}
                  </div>
                ))}
              </div>
              <div className="text-sm text-muted-foreground">
                Join <span className="font-semibold text-foreground">500+</span> developers
              </div>
            </div>
          </motion.div>

          {/* Right side - Sign up form */}
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
                Create your account
              </CardTitle>
              <CardDescription className="text-base">
                Get started with AutoReport in seconds
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Check if any providers are available */}
              {(!providers || Object.keys(providers).length === 0) ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Authentication is currently unavailable. Please try again later.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {/* Full access GitHub provider */}
                  {providers.github && (
                    <Button
                      onClick={() => handleSignUp('github')}
                      disabled={isLoading}
                      className="w-full h-auto py-4 px-4 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                      variant="default"
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                      ) : (
                        <Github className="h-5 w-5 mr-3" />
                      )}
                      <div className="flex flex-col items-start text-left flex-1">
                        <span className="font-semibold">Sign up with GitHub</span>
                        <span className="text-xs opacity-90 font-normal">
                          Full access to public and private repos
                        </span>
                      </div>
                    </Button>
                  )}

                  {/* Public-only GitHub provider - only show if configured */}
                  {providers['github-public'] && (
                    <Button
                      onClick={() => handleSignUp('github-public')}
                      disabled={isLoading}
                      className="w-full h-auto py-4 px-4 text-base"
                      variant="outline"
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                      ) : (
                        <Github className="h-5 w-5 mr-3" />
                      )}
                      <div className="flex flex-col items-start text-left flex-1">
                        <span className="font-semibold">Public Repos Only</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          Access only public repositories
                        </span>
                      </div>
                    </Button>
                  )}
                </div>
              )}

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Already have an account?
                  </span>
                </div>
              </div>

              <div className="text-center">
                <Link href="/auth/signin">
                  <Button variant="ghost" className="w-full group">
                    Sign in instead
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-center text-muted-foreground">
                  By signing up, you agree to our{' '}
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
        </div>

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

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SignUpContent />
    </Suspense>
  );
}
