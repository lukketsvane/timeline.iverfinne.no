import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return new Response('Missing url parameter', { status: 400 })
  }

  // Only proxy Notion S3 URLs
  if (!url.includes('s3.us-west-2.amazonaws.com') && !url.includes('s3.amazonaws.com')) {
    return Response.redirect(url, 302)
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) {
      return new Response('Image not found', { status: 404 })
    }

    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
    })
  } catch {
    return new Response('Failed to fetch image', { status: 502 })
  }
}
