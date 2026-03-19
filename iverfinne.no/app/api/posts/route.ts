import { NextRequest, NextResponse } from 'next/server'
import { getPublishedPosts, serializePostContent } from '@/lib/notion'

export const dynamic = 'force-dynamic'

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

    const postsWithContent = await Promise.all(posts.map(serializePostContent))

    return NextResponse.json(postsWithContent)
  } catch (error: any) {
    console.error('Error fetching posts from Notion:', error)
    return NextResponse.json({
      error: 'Failed to fetch posts',
      details: error.message
    }, { status: 500 })
  }
}
