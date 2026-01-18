import GitHubProvider from 'next-auth/providers/github';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';

// Build providers array dynamically based on available credentials
const providers = [];

// Profile callback to normalize GitHub data
const githubProfile = (profile) => {
  return {
    id: profile.id.toString(),
    name: profile.name || profile.login,
    email: profile.email,
    image: profile.avatar_url,
    // Pass the raw profile data through for our callbacks
    login: profile.login,
    githubId: profile.id,
  };
};

// Provider for Full Access (Public & Private) - Required
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHubProvider({
      id: 'github',
      name: 'GitHub (All Repos)',
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'read:user user:email repo',
          prompt: 'select_account', // Force account selection for switching accounts
        },
      },
      profile: githubProfile,
    })
  );
} else {
  console.warn('[Auth] Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET - GitHub full access provider disabled');
}

// Provider for Public Access Only - Optional
if (process.env.GITHUB_PUBLIC_CLIENT_ID && process.env.GITHUB_PUBLIC_CLIENT_SECRET) {
  providers.push(
    GitHubProvider({
      id: 'github-public',
      name: 'GitHub (Public Only)',
      clientId: process.env.GITHUB_PUBLIC_CLIENT_ID,
      clientSecret: process.env.GITHUB_PUBLIC_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'read:user user:email public_repo',
          prompt: 'select_account', // Force account selection for switching accounts
        },
      },
      profile: githubProfile,
    })
  );
} else {
  console.warn('[Auth] Missing GITHUB_PUBLIC_CLIENT_ID or GITHUB_PUBLIC_CLIENT_SECRET - GitHub public-only provider disabled');
}

export const authOptions = {
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'github' || account?.provider === 'github-public') {
        try {
          // profile contains the RAW GitHub API response
          // user contains our normalized data from the profile callback
          const githubProfile = profile || {};
          const login = githubProfile.login || user?.login || user?.name;
          const githubId = githubProfile.id || user?.githubId;

          // Validate that we have the required data
          if (!githubId || !login) {
            console.error('[Auth] Invalid GitHub data received:', { 
              hasProfile: !!profile,
              hasUser: !!user,
              login,
              githubId,
            });
            // Still allow sign in
            return true;
          }

          await dbConnect();
          // Create/update user in our database
          const dbUser = await User.findOrCreateFromGitHub({
            id: githubId,
            login: login,
            email: githubProfile.email || user?.email,
            name: githubProfile.name || user?.name,
            avatar_url: githubProfile.avatar_url || user?.image,
          });
          
          // Update preferred provider if it has changed
          if (dbUser && dbUser.preferredProvider !== account.provider) {
            dbUser.preferredProvider = account.provider;
            await dbUser.save();
          }
          
          return true;
        } catch (error) {
          console.error('[Auth] Error in signIn callback:', error?.message || error);
          // We allow sign in even if DB update fails to avoid blocking user
          return true;
        }
      }
      return true;
    },
    async jwt({ token, account, profile, user }) {
      // Persist the OAuth access_token and profile data
      // On initial sign in, we have account, profile, and user
      // On subsequent requests, we only have token
      if (account) {
        token.accessToken = account.access_token;
        // Use data from raw profile first, fallback to normalized user
        token.githubId = profile?.id || user?.githubId;
        token.githubUsername = profile?.login || user?.login || user?.name;
      }
      return token;
    },
    async session({ session, token }) {
      // Add custom properties to session with null checks
      if (session) {
        session.accessToken = token?.accessToken;
        if (session.user) {
          session.user.githubId = token?.githubId;
          session.user.githubUsername = token?.githubUsername;
        }
      }
      
      // We could also fetch DB user ID here if needed, 
      // but for now we rely on githubUsername/accessToken via JWT
      return session;
    },
  },
  // Custom authentication pages
  pages: {
    signIn: '/auth/signin',
    signOut: '/',
    error: '/auth/signin', // Redirect to signin on error
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  events: {
    async signOut({ token }) {
      // Log signout event
      console.log('User signed out:', token?.githubUsername || 'unknown');
    },
    async signIn({ user, account, profile, isNewUser }) {
      // user contains our normalized data from the profile callback (including login)
      // profile contains raw OAuth provider data (may be undefined in events)
      const username = user?.login || user?.name || profile?.login || 'unknown';
      
      // Track if this is a new user signup or returning login
      if (isNewUser) {
        console.log('[Auth] New user signed up:', username);
      } else {
        console.log('[Auth] User logged in:', username);
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
