/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    GITHUB_PAT: process.env.GITHUB_PAT,
  },
  images: {
    domains: ['raw.githubusercontent.com'],
  },
}

export default nextConfig