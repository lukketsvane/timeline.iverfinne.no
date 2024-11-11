/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    GITHUB_PAT: process.env.GITHUB_PAT,
  },
}

export default nextConfig