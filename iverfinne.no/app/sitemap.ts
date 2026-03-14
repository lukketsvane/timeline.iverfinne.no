import type { MetadataRoute } from 'next'
import { getPublishedPosts, VALID_TYPES } from '@/lib/notion'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedPosts()

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `https://iverfinne.no/${post.type.toLowerCase()}/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

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
