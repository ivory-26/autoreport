import { withAuth } from 'next-auth/middleware';

// Middleware function that protects routes
export default withAuth({
  pages: {
    signIn: '/auth/signin', // Redirect to custom signin page
  },
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

// Only apply middleware to these paths
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/project/:path*',
    '/settings/:path*',
  ],
};
