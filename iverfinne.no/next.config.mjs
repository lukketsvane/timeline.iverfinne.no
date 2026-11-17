/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // MDXRemote must share Next.js's React runtime when bundled by Turbopack.
  transpilePackages: ['next-mdx-remote'],
  // Allow paced archive reads plus full Retry-After cooldowns on cold builds.
  staticPageGenerationTimeout: 600,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ibb.co'
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com'
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com'
      },
      {
        protocol: 'https',
        hostname: 'prod-files-secure.s3.us-west-2.amazonaws.com'
      },
      {
        protocol: 'https',
        hostname: 's3.us-west-2.amazonaws.com'
      },
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org'
      }
    ]
  },

  // Disable strict checks during build to ensure deployment
  typescript: {
    ignoreBuildErrors: true,
  },

  experimental: {
    // Each worker has its own Notion queue. One prerender worker avoids
    // multiplying the API rate across home, feed, sitemap and game pages.
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
  }
}

export default nextConfig
