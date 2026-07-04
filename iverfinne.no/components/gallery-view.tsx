'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { ExternalLink, ArrowUpRight, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, notionImgSrc, notionImgSrcSet } from '@/lib/utils'
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
  bodyImages?: { src: string; alt: string }[]
  bodyModels?: string[]
  imageDims?: Record<string, { w: number; h: number }>
}

// Column widths in the masonry (2 → 3 → 4 columns).
const FRAME_SIZES = '(min-width: 1024px) 270px, (min-width: 640px) 33vw, 50vw'

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
// and bare image/proxy URLs. Fallback for posts without server-extracted
// bodyImages (e.g. bare external URLs pasted in text).
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
  alt?: string
  post: GalleryPost
  model?: boolean
  dims?: { w: number; h: number }
}

// Flatten posts into individual frames: the hero image (cover/sosialbilete),
// every image in the post body, and any 3D models attached in the body.
function buildItems(posts: GalleryPost[]): GalleryItem[] {
  const items: GalleryItem[] = []
  for (const post of posts) {
    // Model-only posts contribute an interactive 3D frame instead of an image.
    if (post.modelSrc) {
      items.push({ key: `${post.uid}-model`, src: post.modelSrc, post, model: true })
      continue
    }
    const srcs: string[] = []
    const alts = new Map<string, string>()
    const add = (src?: string, alt?: string) => {
      if (!src || src.endsWith('.glb') || srcs.includes(src)) return
      srcs.push(src)
      if (alt) alts.set(src, alt)
    }
    // Hero first (sosialbilete/cover/og-image). Bilete posts skip it — their
    // cover usually repeats one of the body images under a different URL.
    if (post.type !== 'Bilete') add(pickImage(post))
    for (const t of post.thumbnails || []) add(t.src, t.alt)
    // Every image in the post body, server-extracted in document order; fall
    // back to scanning the markdown when that list isn't available.
    if (post.bodyImages?.length) {
      for (const im of post.bodyImages) add(im.src, im.alt)
    } else {
      for (const src of extractContentImages(post.content)) add(src)
    }
    srcs.forEach((src, i) =>
      items.push({ key: `${post.uid}-${i}`, src, alt: alts.get(src), post, dims: post.imageDims?.[src] })
    )
    // Models attached inside the body get their own interactive frames.
    for (const [i, m] of (post.bodyModels || []).entries()) {
      items.push({ key: `${post.uid}-bodymodel-${i}`, src: m, post, model: true })
    }
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
  // Real ratio when the server probed it (no layout shift); otherwise start
  // with a hashed guess and refine once the image loads.
  const [ar, setAr] = useState(() =>
    item.dims ? closestAr(item.dims.w / item.dims.h) : SNAP_ARS[hash(item.key) % SNAP_ARS.length]
  )
  const color = FILL_COLORS[hash('clr' + item.key) % FILL_COLORS.length]

  // 3D models render live in the grid (rotatable in place, no lightbox).
  if (item.model) {
    return (
      <div className="overflow-hidden rounded-2xl">
        <ModelViewer src={item.src} alt={item.alt || item.post.title} />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:focus-visible:ring-gray-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
      aria-label={item.alt || item.post.title}
    >
      <div
        className="relative w-full overflow-hidden rounded-2xl transition-transform duration-300 ease-out hover:scale-[1.02]"
        style={{ aspectRatio: String(ar), backgroundColor: color }}
      >
        <img
          src={notionImgSrc(item.src, 640)}
          srcSet={notionImgSrcSet(item.src)}
          sizes={FRAME_SIZES}
          alt={item.alt || item.post.title}
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

  // Preload the neighbours so stepping never shows a blank frame.
  useEffect(() => {
    for (const d of [-1, 1]) {
      const it = items[(index + d + items.length) % items.length]
      if (it && !it.model) {
        const img = new Image()
        img.src = notionImgSrc(it.src, 1600)
      }
    }
  }, [index, items])

  // Pointer-based swipe (mirrors image-gallery.tsx): horizontal flicks step,
  // a firm vertical flick closes. Deliberately NOT framer-motion drag — motion
  // components that mount/unmount inside an open AnimatePresence subtree (the
  // img remounts on every step) break its exit bookkeeping and the overlay
  // never unmounts.
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const draggingRef = useRef(false)
  const axisRef = useRef<'none' | 'x' | 'y'>('none')

  const onDown = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    draggingRef.current = false
    axisRef.current = 'none'
    setOffset({ x: 0, y: 0 })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!startRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (axisRef.current === 'none' && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      draggingRef.current = true
    }
    if (axisRef.current === 'x') setOffset({ x: dx, y: 0 })
    else if (axisRef.current === 'y') setOffset({ x: 0, y: dy })
  }
  const onUp = () => {
    if (!startRef.current) return
    const dt = Math.max(Date.now() - startRef.current.t, 1)
    if (axisRef.current === 'y' && (Math.abs(offset.y) > 80 || (Math.abs(offset.y) / dt) * 1000 > 500)) {
      onClose()
    } else if (axisRef.current === 'x' && (Math.abs(offset.x) > 50 || (Math.abs(offset.x) / dt) * 1000 > 400)) {
      go(offset.x > 0 ? -1 : 1)
    }
    startRef.current = null
    draggingRef.current = false
    axisRef.current = 'none'
    setOffset({ x: 0, y: 0 })
  }

  const item = items[index]
  const post = item.post
  const isLink = post.type === 'Lenkje' && post.url
  const iconClass = 'text-white/70 hover:text-white transition-colors'
  const swipeScale = 1 - Math.min(Math.abs(offset.y) / 500, 0.15)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      role="dialog"
      aria-modal="true"
      aria-label={item.alt || post.title}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <span
        className="absolute left-4 top-4 text-xs tabular-nums text-white/50"
        style={{ marginTop: 'max(0px, env(safe-area-inset-top))' }}
      >
        {index + 1} / {items.length}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose() }}
        aria-label="Lukk"
        className="absolute right-3 top-3 z-10 p-3 text-white/60 transition-colors hover:text-white"
        style={{ marginTop: 'max(0px, env(safe-area-inset-top))' }}
      >
        <X className="h-6 w-6" />
      </button>

      {/* Click outside to close; click the left/right half of the image to step */}
      <div className="inline-flex max-w-full flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          {item.model ? (
            <div className="h-[70vh] w-[70vh] max-w-[85vw]">
              <ModelViewer src={item.src} alt={post.title} className="h-full" />
            </div>
          ) : (
            <img
              src={notionImgSrc(item.src, 1600)}
              alt={item.alt || post.title}
              width={item.dims?.w}
              height={item.dims?.h}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="max-h-[78vh] max-w-full select-none rounded-xl object-contain"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${swipeScale})`,
                transition: draggingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
                touchAction: 'none',
                width: 'auto',
                height: 'auto',
              }}
              draggable={false}
            />
          )}
          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Førre"
                className="group absolute inset-y-0 left-0 hidden w-1/2 cursor-w-resize items-center justify-start p-3 sm:flex"
              >
                <ChevronLeft className="h-7 w-7 text-white/0 drop-shadow transition-colors group-hover:text-white/80" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Neste"
                className="group absolute inset-y-0 right-0 hidden w-1/2 cursor-e-resize items-center justify-end p-3 sm:flex"
              >
                <ChevronRight className="h-7 w-7 text-white/0 drop-shadow transition-colors group-hover:text-white/80" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-sans text-sm leading-snug text-white/90">{post.title}</p>
            <span className="text-xs tabular-nums text-white/50">{fmtDate(post.date)}</span>
          </div>
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
    </motion.div>
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
      <AnimatePresence>
        {active !== null && (
          <Lightbox items={items} index={active} onClose={() => setActive(null)} onNavigate={setActive} />
        )}
      </AnimatePresence>
    </>
  )
}
