import { NextRequest, NextResponse } from 'next/server'
import { refreshNotion, validateSecret } from '@/lib/revalidation'

function doRevalidate(path: string | null) {
  refreshNotion()
  return path || '/'
}

// Manual refresh. Publishing needs no call: pages refresh themselves (ISR).
// Usage: POST /api/revalidate with `Authorization: Bearer <REVALIDATION_SECRET>`,
// or a JSON body { secret, path? }. The body is optional.
export async function POST(request: NextRequest) {
  let body: { secret?: unknown; path?: unknown } | null = null
  const raw = await request.text()
  if (raw.trim()) {
    try {
      body = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
  }
  try {
    const secret = request.headers.get('authorization')?.replace(/^Bearer /i, '') || body?.secret
    if (!validateSecret(secret)) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    const revalidated = doRevalidate(typeof body?.path === 'string' ? body.path : null)

    return NextResponse.json({
      revalidated: true,
      path: revalidated,
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 })
  }
}
