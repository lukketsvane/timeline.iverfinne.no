'use client'

import { useState } from 'react'
import Link from 'next/link'
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

// Frame shapes derived from the physical wooden block set.
// `ar` is the CSS aspect-ratio (width / height).
const SHAPES: { ar: number; radius: string }[] = [
  { ar: 1, radius: 'rounded-2xl' },    // cyan_kube 30×30 / oransje_rektangel 45×45
  { ar: 1, radius: 'rounded-full' },   // raud_sylinder, topp (sirkel)
  { ar: 0.5, radius: 'rounded-2xl' },  // blå_liten 30×60, ståande
  { ar: 2, radius: 'rounded-2xl' },    // blå_liten, liggjande
  { ar: 0.4, radius: 'rounded-2xl' },  // blå_stor 30×75, ståande
  { ar: 2.5, radius: 'rounded-2xl' },  // blå_stor, liggjande
  { ar: 0.5, radius: 'rounded-full' }, // raud_sylinder, side (pille)
]

// Stable hash so each post keeps the same shape/colour across renders (and
// matches between server and client — no hydration flicker).
function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (str.charCodeAt(i) + ((h << 5) - h)) | 0
  return Math.abs(h)
}

function pickImage(post: GalleryPost): string | undefined {
  return post.sosialbilete || post.image || post.ogImage || post.thumbnails?.[0]?.src
}

function GalleryFrame({ post }: { post: GalleryPost }) {
  const [loaded, setLoaded] = useState(false)
  const shape = SHAPES[hash(post.uid) % SHAPES.length]
  const color = FILL_COLORS[hash('clr' + post.uid) % FILL_COLORS.length]
  const image = pickImage(post)

  return (
    <div
      className={cn('relative w-full overflow-hidden transition-transform hover:scale-[1.02]', shape.radius)}
      style={{ aspectRatio: String(shape.ar), backgroundColor: color }}
    >
      {image && (
        // Plain <img> — proxied/arbitrary URLs not in next/image remotePatterns.
        // Block fill colour stays visible until the image fades in on load.
        <img
          src={image}
          alt={post.title}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}
    </div>
  )
}

export default function GalleryView({ posts }: { posts: GalleryPost[] }) {
  // Gallery only shows posts that actually have an image (e.g. skip writing
  // posts without one) — an image gallery shouldn't be padded with blanks.
  const withImages = posts.filter((p) => pickImage(p))

  if (withImages.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 text-sm">Fann ingen bilete som passar søket.</p>
  }

  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
      {withImages.map((post) => {
        const isLink = post.type === 'Lenkje' && post.url
        const cls = 'block mb-3 break-inside-avoid'
        return isLink ? (
          <a key={post.uid} href={post.url} target="_blank" rel="noopener noreferrer" className={cls} aria-label={post.title}>
            <GalleryFrame post={post} />
          </a>
        ) : (
          <Link key={post.uid} href={`/${post.type.toLowerCase()}/${post.slug}`} className={cls} aria-label={post.title}>
            <GalleryFrame post={post} />
          </Link>
        )
      })}
    </div>
  )
}
