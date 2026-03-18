import { NextRequest, NextResponse } from 'next/server'
import { getPublishedPosts, getPostContent, getSafeScope } from '@/lib/notion'
import { serialize } from 'next-mdx-remote/serialize'
import remarkGfm from 'remark-gfm'

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET(request: NextRequest) {
  try {
    const withContent = request.nextUrl.searchParams.get('content') === '1'

    const posts = await getPublishedPosts()

    if (posts.length === 0) {
       return NextResponse.json([])
    }

    if (!withContent) {
      return NextResponse.json(posts)
    }

    // Return posts with pre-serialized content
    const postsWithContent = await Promise.all(posts.map(async (post) => {
      if (!post.id) return post
      try {
        const content = await getPostContent(post.id)
        const serialized = await serialize(content, {
          mdxOptions: { remarkPlugins: [remarkGfm], format: 'mdx' },
          scope: getSafeScope(content)
        })
        return { ...post, content, serialized }
      } catch {
        return post
      }
    }))

    return NextResponse.json(postsWithContent)
  } catch (error: any) {
    console.error('Error fetching posts from Notion:', error)
    return NextResponse.json({
      error: 'Failed to fetch posts',
      details: error.message
    }, { status: 500 })
  }
}
