import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { NOTION_CACHE_TAG } from '@/lib/notion'

function validateSecret(secret: string | null): boolean {
  return secret === process.env.REVALIDATION_SECRET
}

function doRevalidate(path: string | null) {
  // Data cache first (post list, per-post content, image URLs), then the
  // route cache — so the re-render sees fresh Notion data.
  revalidateTag(NOTION_CACHE_TAG)
  if (path) {
    revalidatePath(path)
  } else {
    revalidatePath('/', 'layout')
  }
  return path || '/'
}

// GET: backward-compatible with Make.com polling
// Usage: GET /api/revalidate?secret=...&path=/skriving/my-post (path optional)
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
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
  try {
    const body = await request.json()
    if (!validateSecret(body.secret)) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    const revalidated = doRevalidate(body.path || null)

    return NextResponse.json({
      revalidated: true,
      path: revalidated,
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
