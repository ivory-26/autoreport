/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Ensure proper handling of environment variables
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  // Optimize for production
  poweredByHeader: false,
  compress: true,
  // Handle image optimization
  images: {
    domains: ['avatars.githubusercontent.com'],
  },
};

export default nextConfig;
