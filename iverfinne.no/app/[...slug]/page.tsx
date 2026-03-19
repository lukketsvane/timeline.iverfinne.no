export const revalidate = 60

import { getPublishedPosts, getPostBySlug, getPostContent, getSafeScope, VALID_TYPES } from '@/lib/notion'
import { notFound, redirect } from 'next/navigation'
import { serialize } from 'next-mdx-remote/serialize'
import remarkGfm from 'remark-gfm'
import rehypePrismPlus from 'rehype-prism-plus'
import MDXBlog from '@/components/mdx-blog'
import SlugPageClient from '@/components/slug-page-client'

async function serializePost(post: any) {
  if (!post.id) return post
  try {
    const content = await getPostContent(post.id)
    const serialized = await serialize(content, {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [[rehypePrismPlus, { ignoreMissing: true }]],
        format: 'mdx',
      },
      scope: getSafeScope(content)
    })
    return { ...post, content, serialized }
  } catch (e) {
    console.error(`Error serializing post ${post.id}:`, e)
    return post
  }
}

export default async function DynamicPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug: segments } = await params

  // Single segment: type filter page or bare slug redirect
  if (segments.length === 1) {
    const slugLower = segments[0].toLowerCase()

    if (VALID_TYPES.includes(slugLower)) {
      const posts = await getPublishedPosts()
      const postsWithContent = await Promise.all(posts.map(serializePost))
      const displayType = segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
      return (
        <div className="w-full max-w-6xl mx-auto px-4 py-8 overflow-x-hidden">
          <MDXBlog initialPosts={JSON.parse(JSON.stringify(postsWithContent))} initialType={displayType} />
        </div>
      )
    }

    // Bare slug — find post and redirect to /type/slug
    const posts = await getPublishedPosts()
    const found = posts.find(p => p.slug === segments[0])
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

    // Fetch single post directly instead of loading all posts
    const post = await getPostBySlug(slugSeg)

    if (!post || post.type.toLowerCase() !== typeSeg.toLowerCase()) {
      notFound()
    }

    const fullPost = await serializePost(post)

    return <SlugPageClient post={JSON.parse(JSON.stringify(fullPost))} />
  }

  notFound()
}
