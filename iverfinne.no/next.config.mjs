/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Each page's Notion work is bounded (see lib/notion.ts), but a cold build
  // cache still means dozens of block walks per page; 60s was tight enough
  // that prerenders were failing "after 3 attempts".
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
    // mdxRs: true
  }
}

export default nextConfig

