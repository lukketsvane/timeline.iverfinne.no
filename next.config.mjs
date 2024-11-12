/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    GITHUB_PAT: process.env.GITHUB_PAT,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

export default nextConfig