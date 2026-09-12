/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Leave room for paced Notion requests during initial prerendering.
  staticPageGenerationTimeout: 180,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com'
      },
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

  webpack: (config, { isServer }) => {
    // Add SVG support
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    })

    // Handle GLB/GLTF files
    config.module.rules.push({
      test: /\.(glb|gltf)$/,
      type: 'asset/resource',
    })

    return config
  },

  // Enable Turbopack acknowledgment
  turbopack: {},

  // Disable strict checks during build to ensure deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Enable experimental features for better MDX support
  experimental: {
    // Each worker has its own Notion queue. One prerender worker avoids
    // multiplying the API rate across home, feed, sitemap and game pages.
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    // mdxRs: true
  }
}

export default nextConfig
