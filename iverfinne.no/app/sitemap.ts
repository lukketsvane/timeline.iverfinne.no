import type { MetadataRoute } from 'next'
import { getPublishedPostsLite, VALID_TYPES } from '@/lib/notion'

// Revalidate hourly instead of force-dynamic: a sitemap doesn't need realtime
// data, and force-dynamic re-ran the full Notion query (+ OG + thumbnail
// fetches) on every crawler hit.
export const revalidate = 3600
// A sitemap needs only the database rows, so it uses the metadata-only list.
// The full one scans every post's blocks, which timed this route out at 60s.
export const maxDuration = 60

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A sitemap without post URLs beats a 500: crawlers keep the static entries
  // and Next retries the list on the next revalidation instead of caching a
  // failure.
  let posts: Awaited<ReturnType<typeof getPublishedPostsLite>> = []
  try {
    posts = await getPublishedPostsLite()
  } catch (error) {
    console.error('sitemap: post list unavailable, emitting static entries only:', error)
  }

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => {
    // Image annotations are optional. The metadata-only list carries whatever
    // the database row itself holds (cover, image property, sosialbilete); it
    // deliberately does not scan post bodies to find one.
    const img = post.image || post.sosialbilete
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
