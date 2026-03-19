import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type')
    const signature = request.headers.get('x-notion-signature')
    console.log('[webhook] headers:', { contentType, signature: signature ? 'present' : 'missing' })

    const body = await request.json()

    // Handle Notion webhook verification challenge
    if (body.challenge) {
      console.log('[webhook] responding to challenge')
      return NextResponse.json({ challenge: body.challenge })
    }

    const eventType = body.type || body.event?.type || 'unknown'
    const entityId = body.data?.id || body.entity?.id || 'unknown'
    console.log('[webhook] received:', eventType, 'entity:', entityId)
    console.log('[webhook] payload:', JSON.stringify(body).slice(0, 500))

    // Revalidate all pages — no unstable_cache, just route cache
    revalidatePath('/', 'layout')

    console.log('[webhook] revalidated all paths')
    return NextResponse.json({
      ok: true,
      revalidated: true,
      event: eventType,
      timestamp: new Date().toISOString()
    }, { status: 200 })
  } catch (error) {
    console.error('[webhook] Error:', error)
    // Still return 200 so Notion doesn't retry
    return NextResponse.json({
      ok: true,
      error: process.env.NODE_ENV !== 'production' ? String(error) : undefined,
      timestamp: new Date().toISOString()
    }, { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}
