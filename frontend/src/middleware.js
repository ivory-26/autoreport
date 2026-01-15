import { withAuth } from 'next-auth/middleware';

// Middleware function that protects routes
export default withAuth({
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
