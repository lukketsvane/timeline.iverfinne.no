import { NextResponse } from 'next/server'
import { getPublishedPosts } from '@/lib/notion'

// Same ISR window as the pages it lists.
export const revalidate = 300
export const maxDuration = 60

// Public files every page can show: the "Om meg" portrait, the header logo
// posters (the logo videos fall back to these offline) and the icons.
const STATIC_FILES = [
  '/images/om-meg.jpg',
  '/icon.svg',
  '/icon-white.png',
  '/apple-icon.png',
  ...['03', '04', '05', '06', '07'].map((v) => `/logo/${v}.png`),
]

// What the home-screen app keeps for offline use (read by public/sw.js):
// every post page, every image those pages show (the worker picks the size),
// and files that are fetched as-is (3D models, expandable post bodies,
// static assets). Only same-origin paths: other sites can't be stored.
export async function GET() {
  const posts = await getPublishedPosts()
  const pages = ['/', ...posts.map((p) => `/${p.type.toLowerCase()}/${p.slug}`)]
  const images = new Set<string>()
  const files = new Set<string>(STATIC_FILES)
  const local = (src?: string) => !!src && src.startsWith('/') && !src.startsWith('//')

  for (const p of posts) {
    for (const src of [
      p.image,
      p.sosialbilete,
      p.ogImage,
      ...(p.thumbnails || []).map((t) => t.src),
      ...(p.bodyImages || []).map((i) => i.src),
    ]) {
      if (local(src) && !src!.endsWith('.glb')) images.add(src!)
    }
    for (const src of [p.modelSrc, ...(p.bodyModels || [])]) if (local(src)) files.add(src!)
    // "Les meir" cards fetch their body on demand from here.
    if (p.lesMeir && p.id && p.type !== 'Interaktiv') files.add(`/api/posts/${p.id}`)
  }

  return NextResponse.json(
    { pages, images: [...images], files: [...files] },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' } }
  )
}
