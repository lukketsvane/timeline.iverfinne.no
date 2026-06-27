import { getPublishedPosts } from '@/lib/notion'

// Revalidate hourly — the feed doesn't need realtime freshness.
export const revalidate = 3600

const SITE = 'https://iverfinne.no'

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string))
}

export async function GET() {
  let posts: Awaited<ReturnType<typeof getPublishedPosts>> = []
  try {
    posts = await getPublishedPosts()
  } catch {
    posts = []
  }

  const items = posts
    .map((p) => {
      const url = `${SITE}/${p.type.toLowerCase()}/${p.slug}`
      const pubDate = new Date(p.date).toUTCString()
      const desc = p.description || p.ogDescription || ''
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(p.type)}</category>${desc ? `\n      <description>${escapeXml(desc)}</description>` : ''}
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>iverfinne.no</title>
    <link>${SITE}</link>
    <description>Personleg nettside og blogg</description>
    <language>nn</language>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
