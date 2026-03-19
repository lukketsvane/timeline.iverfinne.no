import { NextResponse } from 'next/server'
import { getPostContent, serializeMarkdown } from '@/lib/notion'

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id
    const rawContent = await getPostContent(id)
    const serialized = await serializeMarkdown(rawContent)

    return NextResponse.json({ source: serialized }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Error fetching/serializing post content:', error)
    return NextResponse.json({ error: 'Failed to process content' }, { status: 500 })
  }
}
