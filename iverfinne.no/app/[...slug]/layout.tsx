import type { Metadata } from 'next'
import { getPublishedPosts, VALID_TYPES } from '@/lib/notion'
import { generatePostJsonLd } from '@/lib/structured-data'

type Props = {
  params: Promise<{ slug: string[] }>
  children: React.ReactNode
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
    if (!VALID_TYPES.includes(typeSeg.toLowerCase())) return {}

    const posts = await getPublishedPosts()
    const post = posts.find(
      (p) => p.slug === slugSeg && p.type.toLowerCase() === typeSeg.toLowerCase()
    )

    if (!post) return {}

    const image = post.image || post.ogImage
    const description = post.description || `${post.title} — ${post.type} på iverfinne.no`
    const canonical = `/${post.type.toLowerCase()}/${post.slug}`

    return {
      title: post.title,
      description,
      alternates: {
        canonical,
      },
      openGraph: {
        title: post.title,
        description,
        type: 'article',
        publishedTime: post.date,
        authors: ['Iver Finne'],
        ...(image && { images: [{ url: image }] }),
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title: post.title,
        description,
        ...(image && { images: [image] }),
      },
    }
  }

  return {}
}

export default async function SlugLayout({ params, children }: Props) {
  const { slug: segments } = await params

  // Inject JSON-LD for post pages
  if (segments.length === 2) {
    const [typeSeg, slugSeg] = segments
    if (VALID_TYPES.includes(typeSeg.toLowerCase())) {
      const posts = await getPublishedPosts()
      const post = posts.find(
        (p) => p.slug === slugSeg && p.type.toLowerCase() === typeSeg.toLowerCase()
      )

      if (post) {
        const jsonLd = generatePostJsonLd(post)
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
  }

  return <>{children}</>
}
