import { NextRequest } from 'next/server'
import { Client } from '@notionhq/client'

export const dynamic = 'force-dynamic'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

// Allowed hostnames for the URL-based image proxy to prevent SSRF
const ALLOWED_HOSTS = [
  'prod-files-secure.s3.us-west-2.amazonaws.com',
  's3.us-west-2.amazonaws.com',
  's3.amazonaws.com',
  'i.ibb.co',
  'm.media-amazon.com',
  'raw.githubusercontent.com',
  'covers.openlibrary.org',
  'images.unsplash.com',
  'upload.wikimedia.org',
]

function isAllowedUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    return ALLOWED_HOSTS.some(
      host => parsed.hostname === host || parsed.hostname.endsWith('.' + host)
    )
  } catch {
    return false
  }
}

async function fetchAndReturn(imageUrl: string): Promise<Response> {
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) {
    return new Response('Image not found', { status: 404 })
  }
  const buffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') || 'image/jpeg'
  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      // Cache for 5 minutes — proxy is cheap, freshness matters
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    }
  })
}

export async function GET(request: NextRequest) {
  const blockId = request.nextUrl.searchParams.get('block')
  const pageId = request.nextUrl.searchParams.get('page')
  const type = request.nextUrl.searchParams.get('type') // 'cover' or 'icon'
  const url = request.nextUrl.searchParams.get('url')

  try {
    // Block-based: fetch fresh image URL from Notion block
    if (blockId) {
      const block = await notion.blocks.retrieve({ block_id: blockId }) as any
      if (block.type !== 'image') {
        return new Response('Block is not an image', { status: 400 })
      }
      const imageUrl = block.image.type === 'external'
        ? block.image.external.url
        : block.image.file.url
      return fetchAndReturn(imageUrl)
    }

    // Page-based: fetch cover or icon from Notion page
    if (pageId && type) {
      const page = await notion.pages.retrieve({ page_id: pageId }) as any
      let imageUrl: string | null = null

      if (type === 'cover' && page.cover) {
        imageUrl = page.cover.type === 'external'
          ? page.cover.external.url
          : page.cover.file?.url
      } else if (type === 'icon' && page.icon) {
        if (page.icon.type === 'external') imageUrl = page.icon.external.url
        else if (page.icon.type === 'file') imageUrl = page.icon.file.url
      }

      if (!imageUrl) {
        return new Response('Image not found on page', { status: 404 })
      }
      return fetchAndReturn(imageUrl)
    }

    // URL-based fallback — fetch and serve external images
    if (url) {
      if (!isAllowedUrl(url)) {
        return new Response('URL not allowed', { status: 403 })
      }
      return fetchAndReturn(url)
    }

    return new Response('Missing block, page, or url parameter', { status: 400 })
  } catch (error) {
    console.error('[notion-image] Error:', error)
    return new Response('Failed to fetch image', { status: 502 })
  }
}
