import { NextRequest, NextResponse } from 'next/server'
import { refreshNotion, validateSecret } from '@/lib/revalidation'

function doRevalidate(path: string | null) {
  refreshNotion()
  return path || '/'
}

// GET: backward-compatible with Make.com polling
// Usage: GET /api/revalidate?secret=...&path=/skriving/my-post (path optional)
export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace(/^Bearer /i, '')
    || request.nextUrl.searchParams.get('secret')
  if (!validateSecret(secret)) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  const path = request.nextUrl.searchParams.get('path')
  const revalidated = doRevalidate(path)

  return NextResponse.json({
    revalidated: true,
    path: revalidated,
    timestamp: new Date().toISOString(),
  })
}

// POST: alternative for programmatic use
// Usage: POST /api/revalidate with JSON body { secret, path? }
export async function POST(request: NextRequest) {
  let body: { secret?: unknown; path?: string } | null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
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
