import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { revalidatePath } from 'next/cache'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const eventType = body.type || 'unknown'
    console.log('[webhook] received:', eventType, JSON.stringify(body).slice(0, 300))

    // Invalidate all cached Notion data
    revalidateTag('posts')

    // Revalidate all pages that depend on posts
    revalidatePath('/', 'layout')

    console.log('[webhook] revalidated tags and paths')
    return NextResponse.json({ ok: true, revalidated: true }, { status: 200 })
  } catch (error) {
    console.error('[webhook] Error:', error)
    // Still return 200 so Notion doesn't retry
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
