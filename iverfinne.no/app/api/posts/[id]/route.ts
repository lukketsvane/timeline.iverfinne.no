import { NextResponse } from 'next/server'
import { getSerializedPost } from '@/lib/notion'

// Serialized post content changes only on publish. The data-cache entry in
// getSerializedPost (1h, tag-purged by the Notion webhook) is the real
// guard: rebuilding a post's markdown fans out dozens of Notion block calls,
// and every visitor's prefetch loop hits this route for every post.
export const revalidate = 3600

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id
    const { content, source } = await getSerializedPost(id)

    // Return the raw markdown too so the gallery can pull out in-content images.
    return NextResponse.json({ source, content }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
  } catch (error) {
    console.error('Error fetching/serializing post content:', error)
    return NextResponse.json({ error: 'Failed to process content' }, { status: 500, headers: { 'Cache-Control': 'public, max-age=15, s-maxage=60' } })
  }
}
