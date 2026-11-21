'use client'

import { memo, useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { ExternalLink, ArrowUpRight } from 'lucide-react'
import { cn, notionImgSrc, notionImgSrcSet } from '@/lib/utils'
import { ModelViewer } from '@/components/model-viewer'
import { Lightbox, type LightboxItem } from '@/components/lightbox'

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

// Frames a single post may put in the gallery. A long photo essay would
// otherwise flood the wall (and the first load) with every image it holds;
// the rest is one tap away in the post itself.
const MAX_FRAMES_PER_POST = 4

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
// then the post body's images and attached 3D models, in that order, up to
// MAX_FRAMES_PER_POST per post.
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
    const shown = srcs.slice(0, MAX_FRAMES_PER_POST)
    shown.forEach((src, i) =>
      items.push({ key: `${post.uid}-${i}`, src, alt: alts.get(src), post, dims: post.imageDims?.[src] })
    )
    // Models attached inside the body get their own interactive frames, in
    // whatever room the images left.
    const models = (post.bodyModels || []).slice(0, MAX_FRAMES_PER_POST - shown.length)
    for (const [i, m] of models.entries()) {
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

// Where a frame leads: the post page, or straight out for a Lenkje post.
function PostLink({ post, className, children }: {
  post: GalleryPost
  className?: string
  children: React.ReactNode
}) {
  if (post.type === 'Lenkje' && post.url) {
    return (
      <a href={post.url} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link href={`/${post.type.toLowerCase()}/${post.slug}`} className={className}>
      {children}
    </Link>
  )
}

// Memoised: opening the viewer re-renders the gallery, and a few hundred
// frames re-rendering would land right on the opening animation.
const GalleryFrame = memo(function GalleryFrame({ item, index, viewerIndex, onOpen, registerThumb }: {
  item: GalleryItem
  index: number
  viewerIndex: number
  onOpen: (viewerIndex: number) => void
  registerThumb: (viewerIndex: number, el: HTMLElement | null) => void
}) {
  const [loaded, setLoaded] = useState(false)
  // Real ratio when the server probed it (no layout shift); otherwise start
  // with a hashed guess and refine once the image loads.
  const [ar, setAr] = useState(() =>
    item.dims ? closestAr(item.dims.w / item.dims.h) : SNAP_ARS[hash(item.key) % SNAP_ARS.length]
  )
  const color = FILL_COLORS[hash('clr' + item.key) % FILL_COLORS.length]
  const imgRef = useRef<HTMLImageElement>(null)

  // The frames are server-rendered, so an image that finishes before hydration
  // (a cached one, usually) fires its load event with no React handler attached
  // — onLoad alone leaves it stuck at opacity-0 behind the fill colour. Catch
  // that case on mount.
  useEffect(() => {
    const img = imgRef.current
    if (!img?.complete || !img.naturalWidth) return
    setLoaded(true)
    setAr(closestAr(img.naturalWidth / img.naturalHeight))
  }, [])

  // 3D models render live in the grid (rotatable in place, no lightbox).
  if (item.model) {
    return (
      <div className="overflow-hidden rounded-2xl">
        <ModelViewer src={item.src} alt={item.alt || item.post.title} />
      </div>
    )
  }

  return (
    <div
      ref={(el) => registerThumb(viewerIndex, el)}
      className="group relative w-full overflow-hidden rounded-2xl transition-transform duration-300 ease-out [@media(hover:hover)]:hover:scale-[1.02]"
      style={{ aspectRatio: String(ar), backgroundColor: color }}
    >
      <img
        ref={imgRef}
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
      <button
        type="button"
        onClick={() => onOpen(viewerIndex)}
        aria-label={item.alt || item.post.title}
        className="absolute inset-0 h-full w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400"
      />
      {/* Title + date, so a frame is never a mute block and always has a way
          into the post. A block with no image yet (or a broken one) is the
          label: the whole colour field links. Once the image is up the label
          steps back to a hover strip. */}
      <PostLink
        post={item.post}
        className={cn(
          'absolute flex items-end justify-between gap-2 p-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] transition-opacity duration-200',
          loaded
            ? // Hover devices only: on a touch screen the tap that "hovers" would
              // land on the strip and navigate instead of opening the frame.
              'inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent opacity-0 pointer-events-none [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline-none'
            : 'inset-0'
        )}
      >
        <span className="min-w-0">
          <span className="block truncate text-xs leading-snug">{item.post.title}</span>
          {item.post.date && (
            <span className="block text-[10px] tabular-nums text-white/70">{fmtDate(item.post.date)}</span>
          )}
        </span>
        {item.post.type === 'Lenkje' && item.post.url ? (
          <ExternalLink className="h-4 w-4 shrink-0 text-white/80" />
        ) : (
          <ArrowUpRight className="h-4 w-4 shrink-0 text-white/80" />
        )}
      </PostLink>
    </div>
  )
})

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

// The row under a photo in the viewer: the way into its post.
function ViewerCaption({ post }: { post: GalleryPost }) {
  return (
    <PostLink
      post={post}
      className="group/open flex items-center justify-between gap-4 text-white/85 transition-colors hover:text-white"
    >
      <span className="min-w-0">
        <span className="block truncate font-sans text-sm leading-snug underline-offset-4 group-hover/open:underline">
          {post.title}
        </span>
        <span className="block text-xs tabular-nums text-white/55">{fmtDate(post.date)}</span>
      </span>
      {post.type === 'Lenkje' && post.url ? (
        <ExternalLink className="h-6 w-6 shrink-0" />
      ) : (
        <ArrowUpRight className="h-6 w-6 shrink-0" />
      )}
    </PostLink>
  )
}

export default function GalleryView({ posts }: { posts: GalleryPost[] }) {
  const [active, setActive] = useState<number | null>(null)
  const items = useMemo(() => buildItems(posts), [posts])
  const cols = useColumnCount()

  // 3D frames rotate in place and stay out of the viewer; every photo frame
  // gets a slot in it.
  const { viewerItems, viewerIndexOf } = useMemo(() => {
    const viewerItems: LightboxItem[] = []
    const viewerIndexOf = new Map<string, number>()
    for (const item of items) {
      if (item.model) continue
      viewerIndexOf.set(item.key, viewerItems.length)
      viewerItems.push({
        src: item.src,
        alt: item.alt || item.post.title,
        w: item.dims?.w,
        h: item.dims?.h,
        caption: <ViewerCaption post={item.post} />,
      })
    }
    return { viewerItems, viewerIndexOf }
  }, [items])

  const thumbs = useRef<(HTMLElement | null)[]>([])
  const registerThumb = useRef((i: number, el: HTMLElement | null) => { thumbs.current[i] = el }).current

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
              <GalleryFrame
                key={item.key}
                item={item}
                index={index}
                viewerIndex={viewerIndexOf.get(item.key) ?? -1}
                onOpen={setActive}
                registerThumb={registerThumb}
              />
            ))}
          </div>
        ))}
      </div>
      <Lightbox
        items={viewerItems}
        startIndex={active}
        onClose={() => setActive(null)}
        getThumb={(i) => thumbs.current[i]}
      />
    </>
  )
}
