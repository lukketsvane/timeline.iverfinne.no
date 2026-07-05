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
  /**
   * fill: both images absolutely fill the parent (which must have a defined
   * size). Use with a sized wrapper + objectFit="contain" to letterbox an
   * illustration inside a fixed frame. Default (false) lets the low-res image
   * drive the layout height for a full-bleed, natural-aspect hero.
   */
  fill?: boolean
  objectFit?: 'cover' | 'contain'
}

// Blur-up loader: a tiny (fast) variant fills the frame immediately and the
// full-resolution image fades in over it once decoded. Non-proxy URLs pass
// through unchanged (notionImgSrc is a no-op).
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
  fill = false,
  objectFit = 'cover',
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false)
  const low = notionImgSrc(src, lowWidth)
  const full = notionImgSrc(src, fullWidth)
  const srcSet = widths ? notionImgSrcSet(src, widths) : undefined
  const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover'
  // Cover mode hides the low-res upscale behind a blur+overscan; contain mode
  // shows the whole illustration, so only soften it slightly.
  const lowFx = objectFit === 'contain' ? 'blur-[2px]' : 'blur-md scale-105'

  if (fill) {
    return (
      <div className={cn('absolute inset-0', className)}>
        <img
          src={low}
          alt=""
          aria-hidden
          className={cn('absolute inset-0 h-full w-full', fitClass, lowFx, imgClassName)}
        />
        <img
          src={full}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={loading}
          onLoad={() => setLoaded(true)}
          className={cn(
            'absolute inset-0 h-full w-full transition-opacity duration-700 ease-out',
            fitClass,
            loaded ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
        />
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Low-res placeholder — in flow, so it sets the container height instantly. */}
      <img
        src={low}
        alt=""
        aria-hidden
        className={cn('block w-full h-auto scale-105 blur-md', fitClass, imgClassName)}
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
          'absolute inset-0 w-full h-full transition-opacity duration-700 ease-out',
          fitClass,
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
      />
    </div>
  )
}
