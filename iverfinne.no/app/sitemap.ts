import type { MetadataRoute } from 'next'
import { getPublishedPosts, VALID_TYPES } from '@/lib/notion'

// Revalidate hourly instead of force-dynamic: a sitemap doesn't need realtime
// data, and force-dynamic re-ran the full Notion query (+ OG + thumbnail
// fetches) on every crawler hit.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedPosts()

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => {
    const img = post.image || post.ogImage
    return {
      url: `https://iverfinne.no/${post.type.toLowerCase()}/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: 'monthly',
      priority: 0.7,
      ...(img ? { images: [img.startsWith('http') ? img : `https://iverfinne.no${img}`] } : {}),
    }
  })

  const typeEntries: MetadataRoute.Sitemap = VALID_TYPES.map((type) => ({
    url: `https://iverfinne.no/${type}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  return [
    {
      url: 'https://iverfinne.no',
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...typeEntries,
    ...postEntries,
  ]
}
