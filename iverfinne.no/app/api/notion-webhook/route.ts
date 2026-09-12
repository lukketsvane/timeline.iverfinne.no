import { NextRequest, NextResponse } from 'next/server'
import { refreshNotion, validateSecret } from '@/lib/revalidation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Handle Notion webhook verification challenge (no auth needed)
    if (body.challenge) {
      return NextResponse.json({ challenge: body.challenge })
    }

    // Validate secret via query param or x-revalidate-secret header
    const secret = request.nextUrl.searchParams.get('secret')
      || request.headers.get('x-revalidate-secret')
    if (!validateSecret(secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const eventType = body.type || body.event?.type || 'unknown'
    const entityId = body.data?.id || body.entity?.id || 'unknown'
    console.log('[webhook] received:', eventType, 'entity:', entityId)

    refreshNotion()

    return NextResponse.json({
      ok: true,
      revalidated: true,
      event: eventType,
      timestamp: new Date().toISOString()
    }, { status: 200 })
  } catch (error) {
    console.error('[webhook] Error:', error)
    return NextResponse.json({
      ok: false,
      error: process.env.NODE_ENV !== 'production' ? String(error) : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}
