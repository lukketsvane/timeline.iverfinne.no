import { NextResponse } from 'next/server'
import { getSerializedPost } from '@/lib/notion'

// Each layer refreshes after five minutes of use; no external scheduler.
export const revalidate = 300
export const maxDuration = 60

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id
    const { content, source } = await getSerializedPost(id)

    // Return the raw markdown too so the gallery can pull out in-content images.
    return NextResponse.json({ source, content }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' } })
  } catch (error) {
    console.error('Error fetching/serializing post content:', error)
    return NextResponse.json({ error: 'Failed to process content' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } })
  }
}
