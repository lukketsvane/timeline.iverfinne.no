import type { MetadataRoute } from 'next'
import { getPublishedPosts, VALID_TYPES } from '@/lib/notion'

// Revalidate hourly instead of force-dynamic: a sitemap doesn't need realtime
// data, and force-dynamic re-ran the full Notion query (+ OG + thumbnail
// fetches) on every crawler hit.
export const revalidate = 3600
// The post list fans one block-listing out per published post. On the default
// 10s function budget this route could never finish a cold regeneration, so
// every crawler hit re-ran (and re-failed) the whole scan against Notion.
export const maxDuration = 60

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A sitemap without post URLs beats a 500: crawlers keep the static entries
  // and Next retries the list on the next revalidation instead of caching a
  // failure.
  let posts: Awaited<ReturnType<typeof getPublishedPosts>> = []
  try {
    posts = await getPublishedPosts()
  } catch (error) {
    console.error('sitemap: post list unavailable, emitting static entries only:', error)
  }

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
