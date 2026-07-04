import { NextRequest } from 'next/server'
import { Client } from '@notionhq/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

// Widths the resizer will produce — requests snap up to the nearest step so
// the edge cache holds a handful of variants per image instead of hundreds.
const WIDTH_STEPS = [320, 640, 960, 1280, 1600, 2048]

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

// Resize + recompress when the client asked for a width (?w=). WebP when the
// browser accepts it, otherwise the original format. GIFs (animations) and
// SVGs pass through untouched; any sharp failure falls back to the original.
async function transform(
  buffer: ArrayBuffer,
  contentType: string,
  width: number | null,
  acceptsWebp: boolean
): Promise<{ body: ArrayBuffer | Buffer; contentType: string }> {
  const resizable = /image\/(jpeg|png|webp|avif|tiff)/i.test(contentType)
  if (!width || !resizable) return { body: buffer, contentType }
  try {
    const sharp = (await import('sharp')).default
    let img = sharp(Buffer.from(buffer)).rotate().resize({ width, withoutEnlargement: true })
    if (acceptsWebp) {
      return { body: await img.webp({ quality: 80 }).toBuffer(), contentType: 'image/webp' }
    }
    if (/jpeg/i.test(contentType)) {
      return { body: await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer(), contentType }
    }
    if (/png/i.test(contentType)) {
      return { body: await img.png().toBuffer(), contentType }
    }
    return { body: await img.toBuffer(), contentType }
  } catch {
    return { body: buffer, contentType }
  }
}

function parseWidth(request: NextRequest): number | null {
  const raw = request.nextUrl.searchParams.get('w')
  if (!raw) return null
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return WIDTH_STEPS.find(s => s >= n) ?? WIDTH_STEPS[WIDTH_STEPS.length - 1]
}

async function fetchAndReturn(imageUrl: string, request: NextRequest): Promise<Response> {
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) {
    return new Response('Image not found', { status: 404 })
  }
  const buffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const width = parseWidth(request)
  const acceptsWebp = (request.headers.get('accept') || '').includes('image/webp')
  const out = await transform(buffer, contentType, width, acceptsWebp)
  return new Response(out.body as BodyInit, {
    headers: {
      'Content-Type': out.contentType,
      // Images keyed by stable block/page ids rarely change. Cache at the edge
      // for an hour and serve stale while revalidating in the background, so
      // image loads stay fast without re-hitting Notion on every request.
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      // The webp negotiation above makes the response depend on Accept.
      'Vary': 'Accept',
    }
  })
}

export async function GET(request: NextRequest) {
  const blockId = request.nextUrl.searchParams.get('block')
  const pageId = request.nextUrl.searchParams.get('page')
  const type = request.nextUrl.searchParams.get('type') // 'cover' or 'icon'
  const prop = request.nextUrl.searchParams.get('prop') // file property name
  const url = request.nextUrl.searchParams.get('url')

  try {
    // Block-based: fetch fresh file URL from Notion block. Covers image
    // blocks and file blocks (e.g. attached .glb models for <ModelViewer>).
    if (blockId) {
      const block = await notion.blocks.retrieve({ block_id: blockId }) as any
      if (block.type !== 'image' && block.type !== 'file') {
        return new Response('Block is not an image or file', { status: 400 })
      }
      const data = block[block.type]
      const imageUrl = data.type === 'external'
        ? data.external.url
        : data.file.url
      return fetchAndReturn(imageUrl, request)
    }

    // Page-based: cover, icon, or a file property (e.g. prop=sosialbilete)
    if (pageId && (type || prop)) {
      const page = await notion.pages.retrieve({ page_id: pageId }) as any
      let imageUrl: string | null = null

      if (type === 'cover' && page.cover) {
        imageUrl = page.cover.type === 'external'
          ? page.cover.external.url
          : page.cover.file?.url
      } else if (type === 'icon' && page.icon) {
        if (page.icon.type === 'external') imageUrl = page.icon.external.url
        else if (page.icon.type === 'file') imageUrl = page.icon.file.url
      } else if (prop) {
        const key = Object.keys(page.properties || {}).find(
          k => k.toLowerCase() === prop.toLowerCase()
        )
        const file = key ? page.properties[key]?.files?.[0] : undefined
        if (file) imageUrl = file.type === 'external' ? file.external?.url : file.file?.url
      }

      if (!imageUrl) {
        return new Response('Image not found on page', { status: 404 })
      }
      return fetchAndReturn(imageUrl, request)
    }

    // URL-based fallback — fetch and serve external images
    if (url) {
      if (!isAllowedUrl(url)) {
        return new Response('URL not allowed', { status: 403 })
      }
      return fetchAndReturn(url, request)
    }

    return new Response('Missing block, page, or url parameter', { status: 400 })
  } catch (error) {
    console.error('[notion-image] Error:', error)
    return new Response('Failed to fetch image', { status: 502 })
  }
}
