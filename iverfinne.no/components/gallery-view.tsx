'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GalleryPost {
  uid: string
  title: string
  slug: string
  type: string
  url?: string
  image?: string
  ogImage?: string
  sosialbilete?: string
  content?: string
  thumbnails?: { src: string; alt: string }[]
}

// Random fill colours shown behind each frame while the image loads.
const FILL_COLORS = ['#EF4444', '#1D4ED8', '#F97316', '#06B6D4']

// Block aspect ratios (width / height) — the rounded-rectangle "masks" the
// image is fitted into. We snap each image to the closest one so a wide image
// gets a wide mask, a tall image a tall mask, etc.
const SNAP_ARS = [0.4, 0.5, 1, 2, 2.5]

function closestAr(real: number): number {
  return SNAP_ARS.reduce((a, b) => (Math.abs(b - real) < Math.abs(a - real) ? b : a))
}

// Stable hash so each frame keeps the same shape/colour across renders.
function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (str.charCodeAt(i) + ((h << 5) - h)) | 0
  return Math.abs(h)
}

function pickImage(post: GalleryPost): string | undefined {
  return post.sosialbilete || post.image || post.ogImage || post.thumbnails?.[0]?.src
}

// Pull image URLs out of the post's markdown body (![alt](url) and <img src>).
function extractContentImages(content?: string): string[] {
  if (!content) return []
  const urls: string[] = []
  let m: RegExpExecArray | null
  const md = /!\[[^\]]*\]\(([^)\s]+)\)/g
  while ((m = md.exec(content)) !== null) urls.push(m[1])
  const html = /<img[^>]+src=["']([^"']+)["']/g
  while ((m = html.exec(content)) !== null) urls.push(m[1])
  return urls
}

interface GalleryItem {
  key: string
  src: string
  post: GalleryPost
}

// Flatten posts into individual image frames — a Bilete post with several
// thumbnails contributes several frames, not just one.
function buildItems(posts: GalleryPost[]): GalleryItem[] {
  const items: GalleryItem[] = []
  for (const post of posts) {
    const srcs: string[] = []
    const add = (src?: string) => {
      if (src && !src.endsWith('.glb') && !srcs.includes(src)) srcs.push(src)
    }
    for (const t of post.thumbnails || []) add(t.src)
    if (srcs.length === 0) add(pickImage(post))
    // Also pull every image embedded in the post body.
    for (const src of extractContentImages(post.content)) add(src)
    srcs.forEach((src, i) => items.push({ key: `${post.uid}-${i}`, src, post }))
  }
  return items
}

function GalleryFrame({ item, index, onOpen }: { item: GalleryItem; index: number; onOpen: (i: GalleryItem) => void }) {
  const [loaded, setLoaded] = useState(false)
  // Start with a hashed ratio for variety; refine to match the real image on load.
  const [ar, setAr] = useState(() => SNAP_ARS[hash(item.key) % SNAP_ARS.length])
  const color = FILL_COLORS[hash('clr' + item.key) % FILL_COLORS.length]

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="block w-full mb-3 break-inside-avoid"
      aria-label={item.post.title}
    >
      <div
        className="relative w-full overflow-hidden rounded-2xl transition-transform hover:scale-[1.02]"
        style={{ aspectRatio: String(ar), backgroundColor: color }}
      >
        <img
          src={item.src}
          alt={item.post.title}
          // Eagerly load the first frames (near the top) so they appear first.
          loading={index < 6 ? 'eager' : 'lazy'}
          fetchPriority={index < 6 ? 'high' : 'auto'}
          onLoad={(e) => {
            setLoaded(true)
            const img = e.currentTarget
            if (img.naturalWidth && img.naturalHeight) setAr(closestAr(img.naturalWidth / img.naturalHeight))
          }}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      </div>
    </button>
  )
}

function Lightbox({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const post = item.post
  const isLink = post.type === 'Lenkje' && post.url
  const btnClass = 'inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black shadow-lg hover:bg-gray-100 transition-colors'

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Lukk"
      >
        <X className="h-5 w-5" />
      </button>

      <img
        src={item.src}
        alt={post.title}
        className="max-h-[78vh] max-w-full rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <div onClick={(e) => e.stopPropagation()}>
        {isLink ? (
          <a href={post.url} target="_blank" rel="noopener noreferrer" className={btnClass}>
            Opne lenkje
          </a>
        ) : (
          <Link href={`/${post.type.toLowerCase()}/${post.slug}`} className={btnClass}>
            Opne innlegg
          </Link>
        )}
      </div>
    </div>
  )
}

export default function GalleryView({ posts }: { posts: GalleryPost[] }) {
  const [active, setActive] = useState<GalleryItem | null>(null)
  const items = useMemo(() => buildItems(posts), [posts])

  if (items.length === 0) return null

  return (
    <>
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
        {items.map((item, i) => (
          <GalleryFrame key={item.key} item={item} index={i} onOpen={setActive} />
        ))}
      </div>
      {active && <Lightbox item={active} onClose={() => setActive(null)} />}
    </>
  )
}
