import { NextRequest } from 'next/server'
import { Client } from '@notionhq/client'

export const dynamic = 'force-dynamic'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

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

    // URL-based fallback (for S3 URLs in markdown content)
    if (url) {
      if (!url.includes('s3.us-west-2.amazonaws.com') && !url.includes('s3.amazonaws.com')) {
        return Response.redirect(url, 302)
      }
      return fetchAndReturn(url)
    }

    return new Response('Missing block, page, or url parameter', { status: 400 })
  } catch (error) {
    console.error('[notion-image] Error:', error)
    return new Response('Failed to fetch image', { status: 502 })
  }
}
