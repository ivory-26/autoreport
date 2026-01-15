import GitHubProvider from 'next-auth/providers/github';

export const authOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          // Request access to user's repos for webhook setup
          scope: 'read:user user:email repo',
        },
      },
    }),
  ],
  callbacks: {
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
