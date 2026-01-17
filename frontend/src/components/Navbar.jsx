'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { motion } from 'framer-motion';
import { LayoutDashboard, LogOut, Settings, Github } from 'lucide-react';

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const isActive = (path) => pathname === path;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 relative">
        {/* Left: Navigation */}
        <div className="flex items-center justify-start flex-1">
          {session && (
            <nav className="flex items-center space-x-4">
              <Link href="/dashboard" className={`relative text-sm font-medium transition-colors hover:text-primary ${isActive('/dashboard') ? 'text-foreground' : 'text-muted-foreground'}`}>
                Dashboard
                {isActive('/dashboard') && (
                  <motion.div
                    layoutId="navbar-underline"
                    className="absolute left-0 top-full h-[2px] w-full bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            </nav>
          )}
        </div>

        {/* Center: Logo */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Link href="/" className="flex items-center">
            <span className="font-bold text-lg">AutoReport</span>
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center justify-end flex-1 gap-2">
          <ModeToggle />
          {/* Auth Section */}
          {status === 'loading' ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full ring-2 ring-transparent hover:ring-primary/20 transition-all">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.user?.image} alt={session.user?.name} />
                    <AvatarFallback>
                      {session.user?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {session.user?.name && (
                      <p className="font-medium">{session.user.name}</p>
                    )}
                    {session.user?.email && (
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {session.user.email}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="cursor-pointer">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 focus:text-red-600"
                  onClick={() => signOut({ callbackUrl: '/' })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="gap-2 shadow-lg shadow-primary/20">
                  <Github className="h-4 w-4" />
                  Sign In
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Sign in with GitHub</DialogTitle>
                  <DialogDescription>
                    Choose how you want to connect your repositories.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 py-4">
                  <Button
                    onClick={() => signIn('github')}
                    className="w-full justify-start h-auto py-4 px-4"
                    variant="default"
                  >
                    <Github className="h-5 w-5 mr-3 mt-1" />
                    <div className="flex flex-col items-start text-left">
                      <span className="font-semibold">All Repositories</span>
                      <span className="text-xs opacity-90">Access both public and private repos (Recommended).</span>
                    </div>
                  </Button>

                  <Button
                    onClick={() => signIn('github-public')}
                    className="w-full justify-start h-auto py-4 px-4"
                    variant="outline"
                  >
                    <Github className="h-5 w-5 mr-3 mt-1" />
                    <div className="flex flex-col items-start text-left">
                      <span className="font-semibold">Public Repos only</span>
                      <span className="text-xs text-muted-foreground">Access only public repositories.</span>
                    </div>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </nav>
  );
}
