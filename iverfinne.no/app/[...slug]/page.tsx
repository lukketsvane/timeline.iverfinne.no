// Automatic ISR refresh; Make and webhooks are optional.
export const revalidate = 300
export const maxDuration = 60

import { getPublishedPosts, getPostBySlug, serializeMarkdown, VALID_TYPES } from '@/lib/notion'
import { notFound, redirect } from 'next/navigation'
import MDXBlog from '@/components/mdx-blog'
import SlugPageClient from '@/components/slug-page-client'

export default async function DynamicPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug: segments } = await params

  // Single segment: type filter page or bare slug redirect
  if (segments.length === 1) {
    const slugLower = segments[0].toLowerCase()

    if (VALID_TYPES.includes(slugLower)) {
      const posts = await getPublishedPosts()
      return (
        <div className="w-full max-w-6xl mx-auto px-4 py-8 overflow-x-hidden">
          <MDXBlog initialPosts={JSON.parse(JSON.stringify(posts))} initialType={segments[0].charAt(0).toUpperCase() + segments[0].slice(1)} />
        </div>
      )
    }

    // Bare slug — find post and redirect to /type/slug. Looking the single
    // post up directly costs one database query; loading the whole list here
    // rescanned every published page's blocks just to resolve one redirect.
    const found = await getPostBySlug(segments[0])
    if (found) {
      redirect(`/${found.type.toLowerCase()}/${found.slug}`)
    }
    notFound()
  }

  // Two segments: /type/slug — individual post page
  if (segments.length === 2) {
    const [typeSeg, slugSeg] = segments

    if (!VALID_TYPES.includes(typeSeg.toLowerCase())) {
      notFound()
    }

    // Pass the type: two posts can share a slug (/lenkje/piknik vs
    // /prosjekt/piknik), and the URL says which one is meant.
    const post = await getPostBySlug(slugSeg, typeSeg)

    if (!post || post.type.toLowerCase() !== typeSeg.toLowerCase()) {
      notFound()
    }

    // post.content is already populated by getPostBySlug — serialize it directly
    // to avoid a second round of Notion API calls inside serializePostContent.
    // Interaktiv posts are the exception: they render their body in an iframe
    // and never touch `serialized`, and compiling one (100KB of HTML in, 2.2MB
    // of MDX out for /interaktiv/formspraak) only burned render time and
    // inflated the payload.
    const serialized =
      post.type === 'Interaktiv' ? undefined : await serializeMarkdown(post.content)
    const fullPost = { ...post, serialized }

    return <SlugPageClient post={JSON.parse(JSON.stringify(fullPost))} />
  }

  notFound()
}
