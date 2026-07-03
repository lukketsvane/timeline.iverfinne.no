'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ExternalLink, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModelViewer } from '@/components/model-viewer'

interface GalleryPost {
  uid: string
  title: string
  slug: string
  type: string
  date?: string
  url?: string
  image?: string
  ogImage?: string
  sosialbilete?: string
  content?: string
  thumbnails?: { src: string; alt: string }[]
  modelSrc?: string
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

// Pull image URLs out of the post's markdown body: ![alt](url), <img src>,
// and bare image/proxy URLs.
function extractContentImages(content?: string): string[] {
  if (!content) return []
  const urls: string[] = []
  let m: RegExpExecArray | null
  const md = /!\[[^\]]*\]\(([^)\s]+)\)/g
  while ((m = md.exec(content)) !== null) urls.push(m[1])
  const html = /<img[^>]+src=["']([^"']+)["']/g
  while ((m = html.exec(content)) !== null) urls.push(m[1])
  const bare = /(?<!\()\bhttps?:\/\/[^\s)"']+\.(?:png|jpe?g|gif|webp|avif)\b/gi
  while ((m = bare.exec(content)) !== null) urls.push(m[0])
  const proxied = /\/api\/notion-image\?[^\s)"']+/g
  while ((m = proxied.exec(content)) !== null) urls.push(m[0])
  return urls
}

interface GalleryItem {
  key: string
  src: string
  post: GalleryPost
  model?: boolean
}

// Flatten posts into individual image frames — a Bilete post with several
// thumbnails contributes several frames, not just one.
function buildItems(posts: GalleryPost[]): GalleryItem[] {
  const items: GalleryItem[] = []
  for (const post of posts) {
    // Model-only posts contribute an interactive 3D frame instead of an image.
    if (post.modelSrc) {
      items.push({ key: `${post.uid}-model`, src: post.modelSrc, post, model: true })
      continue
    }
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
  // Newest first (stable, so a post's images stay grouped in body order).
  return items.sort((a, b) => (b.post.date || '').localeCompare(a.post.date || ''))
}

// 2024-10-20 → "20.10.2024"
function fmtDate(d?: string): string {
  if (!d) return ''
  const [y, mo, day] = d.slice(0, 10).split('-')
  return day && mo && y ? `${day}.${mo}.${y}` : d
}

function GalleryFrame({ item, index, onOpen }: { item: GalleryItem; index: number; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false)
  // Start with a hashed ratio for variety; refine to match the real image on load.
  const [ar, setAr] = useState(() => SNAP_ARS[hash(item.key) % SNAP_ARS.length])
  const color = FILL_COLORS[hash('clr' + item.key) % FILL_COLORS.length]

  // 3D models render live in the grid (rotatable in place, no lightbox).
  if (item.model) {
    return (
      <div className="overflow-hidden rounded-2xl">
        <ModelViewer src={item.src} alt={item.post.title} />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full"
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

function Lightbox({ items, index, onClose, onNavigate }: {
  items: GalleryItem[]
  index: number
  onClose: () => void
  onNavigate: (i: number) => void
}) {
  const go = (dir: number) => onNavigate((index + dir + items.length) % items.length)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length])

  const item = items[index]
  const post = item.post
  const isLink = post.type === 'Lenkje' && post.url
  const iconClass = 'text-white/70 hover:text-white transition-colors'

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      {/* Click outside to close; click the left/right half of the image to step */}
      <div className="inline-flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          {item.model ? (
            <div className="h-[70vh] w-[70vh] max-w-[85vw]">
              <ModelViewer src={item.src} alt={post.title} className="h-full" />
            </div>
          ) : (
            <img src={item.src} alt={post.title} className="max-h-[78vh] max-w-full rounded-xl object-contain" />
          )}
          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Førre"
                className="group absolute inset-y-0 left-0 flex w-1/2 cursor-w-resize items-center justify-start p-3"
              >
                <ChevronLeft className="h-7 w-7 text-white/0 drop-shadow transition-colors group-hover:text-white/80" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Neste"
                className="group absolute inset-y-0 right-0 flex w-1/2 cursor-e-resize items-center justify-end p-3"
              >
                <ChevronRight className="h-7 w-7 text-white/0 drop-shadow transition-colors group-hover:text-white/80" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm tabular-nums text-white/60">{fmtDate(post.date)}</span>
          {isLink ? (
            <a href={post.url} target="_blank" rel="noopener noreferrer" className={iconClass} aria-label="Opne lenkje">
              <ExternalLink className="h-6 w-6" />
            </a>
          ) : (
            <Link href={`/${post.type.toLowerCase()}/${post.slug}`} className={iconClass} aria-label="Opne innlegg">
              <ArrowUpRight className="h-6 w-6" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// Responsive column count, mirroring the Tailwind breakpoints below.
function useColumnCount(): number {
  const [n, setN] = useState(2)
  useEffect(() => {
    const sm = window.matchMedia('(min-width: 640px)')
    const lg = window.matchMedia('(min-width: 1024px)')
    const update = () => setN(lg.matches ? 4 : sm.matches ? 3 : 2)
    update()
    sm.addEventListener('change', update)
    lg.addEventListener('change', update)
    return () => {
      sm.removeEventListener('change', update)
      lg.removeEventListener('change', update)
    }
  }, [])
  return n
}

export default function GalleryView({ posts }: { posts: GalleryPost[] }) {
  const [active, setActive] = useState<number | null>(null)
  const items = useMemo(() => buildItems(posts), [posts])
  const cols = useColumnCount()

  // CSS multi-column fills column-by-column, which scrambles the date order when
  // read left-to-right. Distribute round-robin instead so the newest sits
  // top-left and reading order (→ then ↓) follows the date, newest first.
  const columns = useMemo(() => {
    const buckets: { item: GalleryItem; index: number }[][] = Array.from({ length: cols }, () => [])
    items.forEach((item, i) => buckets[i % cols].push({ item, index: i }))
    return buckets
  }, [items, cols])

  if (items.length === 0) return null

  return (
    <>
      <div className="flex items-start gap-3">
        {columns.map((col, ci) => (
          <div key={ci} className="flex min-w-0 flex-1 flex-col gap-3">
            {col.map(({ item, index }) => (
              <GalleryFrame key={item.key} item={item} index={index} onOpen={() => setActive(index)} />
            ))}
          </div>
        ))}
      </div>
      {active !== null && (
        <Lightbox items={items} index={active} onClose={() => setActive(null)} onNavigate={setActive} />
      )}
    </>
  )
}
