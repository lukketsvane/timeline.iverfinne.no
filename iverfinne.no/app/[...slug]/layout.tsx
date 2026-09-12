import type { Metadata } from 'next'
import { getPostBySlug, VALID_TYPES } from '@/lib/notion'
import { generatePostJsonLd, generateBreadcrumbJsonLd } from '@/lib/structured-data'
import type { Post } from '@/types/post'

type Props = {
  params: Promise<{ slug: string[] }>
  children: React.ReactNode
}

// A post page must never depend on the whole-site post list. getPublishedPosts
// fans one block-listing out per published post; running that from the layout
// meant every post view (and every .rsc prefetch of one) rescanned the entire
// Notion database, which tripped Notion's rate limit and turned the page into
// "Application error: a server-side exception has occurred".
//
// getPostBySlug is React-cached, so the layout, generateMetadata and the page
// itself share one lookup: a post view now costs a single database query plus
// that post's own blocks.
async function postFor(typeSeg: string, slugSeg: string): Promise<Post | null> {
  if (!VALID_TYPES.includes(typeSeg.toLowerCase())) return null
  try {
    const post = await getPostBySlug(slugSeg, typeSeg)
    if (!post || post.type.toLowerCase() !== typeSeg.toLowerCase()) return null
    return post
  } catch (error) {
    // Metadata and JSON-LD are decoration: a Notion hiccup here must degrade
    // to the site defaults, never take down the page that renders fine.
    console.error(`Post metadata lookup failed for /${typeSeg}/${slugSeg}:`, error)
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: segments } = await params

  // Type filter page: /skriving, /bok, etc.
  if (segments.length === 1 && VALID_TYPES.includes(segments[0].toLowerCase())) {
    const displayType = segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
    return {
      title: displayType,
      description: `Alle ${displayType.toLowerCase()}-innlegg på iverfinne.no`,
      alternates: {
        canonical: `/${segments[0].toLowerCase()}`,
      },
    }
  }

  // Post page: /type/slug
  if (segments.length === 2) {
    const [typeSeg, slugSeg] = segments
    const post = await postFor(typeSeg, slugSeg)
    if (!post) return {}

    // Fall back to the global default sharing image when a post has none, so
    // every page always renders a large image card across platforms.
    const image = post.image || post.thumbnails?.[0]?.src || post.ogImage || '/og-image.png'
    const description = post.description || `${post.title} — ${post.type} på iverfinne.no`
    const canonical = `/${post.type.toLowerCase()}/${post.slug}`

    return {
      title: post.title,
      description,
      keywords: Array.isArray(post.tags) && post.tags.length > 0 ? post.tags : undefined,
      alternates: {
        canonical,
      },
      openGraph: {
        title: post.title,
        description,
        type: 'article',
        url: canonical,
        publishedTime: post.date,
        authors: ['Iver Finne'],
        tags: Array.isArray(post.tags) ? post.tags : undefined,
        images: [{ url: image }],
      },
      twitter: {
        card: 'summary_large_image',
        title: post.title,
        description,
        images: [image],
      },
    }
  }

  return {}
}

export default async function SlugLayout({ params, children }: Props) {
  const { slug: segments } = await params

  // Inject JSON-LD for post pages
  if (segments.length === 2) {
    const post = await postFor(segments[0], segments[1])

    if (post) {
      const jsonLd = [generatePostJsonLd(post), generateBreadcrumbJsonLd(post)]
      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          {children}
        </>
      )
    }
  }

  return <>{children}</>
}
