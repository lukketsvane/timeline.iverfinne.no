import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[webhook]', body.type || 'unknown event', JSON.stringify(body).slice(0, 200))
    revalidateTag('posts', 'max')
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error('[webhook] Error:', error)
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
