'use client'

import { useState } from 'react'
import { cn, notionImgSrc, notionImgSrcSet } from '@/lib/utils'

interface ProgressiveImageProps {
  src: string
  alt?: string
  /** Widths for the full image's srcSet (proxy variants). */
  widths?: number[]
  sizes?: string
  /** Width requested for the main (high-res) image. */
  fullWidth?: number
  /** Width of the blurred low-res placeholder that shows immediately. */
  lowWidth?: number
  className?: string
  imgClassName?: string
  loading?: 'eager' | 'lazy'
}

// Blur-up loader: a tiny (fast) variant fills the frame immediately and drives
// the layout height, while the full-resolution image fades in over it once it
// has decoded. Non-proxy URLs pass through unchanged (notionImgSrc is a no-op),
// so the two <img> tags simply resolve to the same source.
export function ProgressiveImage({
  src,
  alt = '',
  widths,
  sizes,
  fullWidth = 1280,
  lowWidth = 320,
  className,
  imgClassName,
  loading = 'eager',
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false)
  const low = notionImgSrc(src, lowWidth)
  const full = notionImgSrc(src, fullWidth)
  const srcSet = widths ? notionImgSrcSet(src, widths) : undefined

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Low-res placeholder — in flow, so it sets the container height instantly. */}
      <img
        src={low}
        alt=""
        aria-hidden
        className={cn('block w-full h-auto object-cover scale-105 blur-md', imgClassName)}
      />
      {/* Full image fades in on top once decoded. */}
      <img
        src={full}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={loading}
        onLoad={() => setLoaded(true)}
        className={cn(
          'absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
      />
    </div>
  )
}
