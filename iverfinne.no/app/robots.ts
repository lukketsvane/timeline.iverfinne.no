import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/notion-image'],
        disallow: '/api/',
      },
    ],
    sitemap: 'https://iverfinne.no/sitemap.xml',
  }
}
