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
  thumbnails?: { src: string; alt: string }[]
}

// Random fill colours shown behind each frame while the image loads.
const FILL_COLORS = ['#EF4444', '#1D4ED8', '#F97316', '#06B6D4']

// Frame shapes = the wooden blocks seen from the side, i.e. rounded
// rectangles only. `ar` is the CSS aspect-ratio (width / height).
const SHAPES: { ar: number; radius: string }[] = [
  { ar: 1, radius: 'rounded-2xl' },
  { ar: 0.5, radius: 'rounded-2xl' },
  { ar: 2, radius: 'rounded-2xl' },
  { ar: 0.4, radius: 'rounded-2xl' },
  { ar: 2.5, radius: 'rounded-2xl' },
  { ar: 0.5, radius: 'rounded-2xl' },
]

// Stable hash so each frame keeps the same shape/colour across renders.
function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (str.charCodeAt(i) + ((h << 5) - h)) | 0
  return Math.abs(h)
}

function pickImage(post: GalleryPost): string | undefined {
  return post.sosialbilete || post.image || post.ogImage || post.thumbnails?.[0]?.src
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
    for (const t of post.thumbnails || []) {
      if (t.src && !t.src.endsWith('.glb') && !srcs.includes(t.src)) srcs.push(t.src)
    }
    if (srcs.length === 0) {
      const img = pickImage(post)
      if (img && !img.endsWith('.glb')) srcs.push(img)
    }
    srcs.forEach((src, i) => items.push({ key: `${post.uid}-${i}`, src, post }))
  }
  return items
}

function GalleryFrame({ item, onOpen }: { item: GalleryItem; onOpen: (i: GalleryItem) => void }) {
  const [loaded, setLoaded] = useState(false)
  const shape = SHAPES[hash(item.key) % SHAPES.length]
  const color = FILL_COLORS[hash('clr' + item.key) % FILL_COLORS.length]

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="block w-full mb-3 break-inside-avoid"
      aria-label={item.post.title}
    >
      <div
        className={cn('relative w-full overflow-hidden transition-transform hover:scale-[1.02]', shape.radius)}
        style={{ aspectRatio: String(shape.ar), backgroundColor: color }}
      >
        <img
          src={item.src}
          alt={item.post.title}
          loading="lazy"
          onLoad={() => setLoaded(true)}
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
        {items.map((item) => (
          <GalleryFrame key={item.key} item={item} onOpen={setActive} />
        ))}
      </div>
      {active && <Lightbox item={active} onClose={() => setActive(null)} />}
    </>
  )
}
