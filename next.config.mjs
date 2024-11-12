// next.config.mjs
export default {
  env: {
    GITHUB_PAT: process.env.GITHUB_PAT,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.ibb.co',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    domains: ['ibb.co', 'i.ibb.co', 'raw.githubusercontent.com'],
  },
  async headers() {
    return [
      {
        // Apply headers globally
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Authorization',
          },
        ],
      },
    ];
  },
}
