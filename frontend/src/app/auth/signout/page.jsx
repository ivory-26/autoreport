'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

export default function SignOutPage() {
  useEffect(() => {
    const handleSignOut = async () => {
      // Clear localStorage
      localStorage.removeItem('autoreport_last_user');

      // Sign out from NextAuth
      await signOut({
        callbackUrl: '/',
        redirect: true
      });
    };

    handleSignOut();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Signing you out...</p>
      <p className="text-xs text-muted-foreground max-w-md text-center">
        To completely switch GitHub accounts, please also{' '}
        <a
          href="https://github.com/logout"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          sign out from GitHub
        </a>
      </p>
    </div>
  );
}
