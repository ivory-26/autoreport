export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/project/:path*',
    '/settings/:path*',
  ],
};
