import GitHubProvider from 'next-auth/providers/github';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';

export const authOptions = {
  providers: [
    // Provider for Full Access (Public & Private)
    GitHubProvider({
      id: 'github',
      name: 'GitHub (All Repos)',
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'read:user user:email repo',
        },
      },
    }),
    // Provider for Public Access Only
    GitHubProvider({
      id: 'github-public',
      name: 'GitHub (Public Only)',
      clientId: process.env.GITHUB_PUBLIC_CLIENT_ID,
      clientSecret: process.env.GITHUB_PUBLIC_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'read:user user:email public_repo',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account.provider === 'github' || account.provider === 'github-public') {
        try {
          await dbConnect();
          // Profile contains raw GitHub data (id, login, etc) coming from OAuth
          await User.findOrCreateFromGitHub(profile);
          return true;
        } catch (error) {
          console.error('Error in signIn callback:', error);
          // We allow sign in even if DB update fails to avoid blocking user, 
          // but logging is critical.
          return true;
        }
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      // Persist the OAuth access_token and profile data
      if (account) {
        token.accessToken = account.access_token;
        token.githubId = profile?.id;
        token.githubUsername = profile?.login;
      }
      return token;
    },
    async session({ session, token }) {
      // Add custom properties to session
      session.accessToken = token.accessToken;
      session.user.githubId = token.githubId;
      session.user.githubUsername = token.githubUsername;
      
      // We could also fetch DB user ID here if needed, 
      // but for now we rely on githubUsername/accessToken via JWT
      return session;
    },
  },
  // Use default NextAuth pages (custom pages removed for now)
  // pages: {
  //   signIn: '/auth/signin',
  //   error: '/auth/error',
  // },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
