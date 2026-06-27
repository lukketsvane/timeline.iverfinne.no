import { NextResponse } from 'next/server'
import { getPostContent, serializeMarkdown } from '@/lib/notion'

// Cache serialized post content — it changes rarely (only on publish), so
// serving it from cache instead of re-hitting Notion on every expand makes
// loading near-instant. SWR keeps it fresh in the background.
export const revalidate = 300

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id
    const rawContent = await getPostContent(id)
    const serialized = await serializeMarkdown(rawContent)

    // Return the raw markdown too so the gallery can pull out in-content images.
    return NextResponse.json({ source: serialized, content: rawContent }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' } })
  } catch (error) {
    console.error('Error fetching/serializing post content:', error)
    return NextResponse.json({ error: 'Failed to process content' }, { status: 500 })
  }
}
