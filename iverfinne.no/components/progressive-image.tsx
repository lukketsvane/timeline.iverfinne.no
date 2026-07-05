'use client'

import { useRef, useState } from 'react'
import { cn, notionImgSrc, notionImgSrcSet } from '@/lib/utils'

interface ProgressiveImageProps {
  src: string
  alt?: string
  widths?: number[]
  sizes?: string
  fullWidth?: number
  lowWidth?: number
  className?: string
  imgClassName?: string
  loading?: 'eager' | 'lazy'
  /**
   * fill: both images absolutely fill the parent (which must be sized). Default
   * (false) lets the low-res image drive the layout height (full-bleed hero).
   */
  fill?: boolean
  objectFit?: 'cover' | 'contain'
  /**
   * Reports whether the top-left corner of the loaded image is dark, so an
   * overlaid control can pick a legible colour. Proxy images are same-origin,
   * so the canvas read never taints.
   */
  onLuminance?: (isDark: boolean) => void
}

// Progressive loader: a tiny (fast) variant fills the frame immediately and the
// full-resolution image fades in over it once decoded. No blur — a crisp low-res
// that sharpens. Non-proxy URLs pass through unchanged (notionImgSrc is a no-op).
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
  onLuminance,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false)
  const fullRef = useRef<HTMLImageElement>(null)
  const low = notionImgSrc(src, lowWidth)
  const full = notionImgSrc(src, fullWidth)
  const srcSet = widths ? notionImgSrcSet(src, widths) : undefined
  const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover'

  // Sample the top-left region's luminance once the full image has decoded.
  const sampleLuminance = () => {
    if (!onLuminance) return
    const img = fullRef.current
    if (!img) return
    try {
      const cw = 24, ch = 24
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      // Draw just the top-left ~45% × ~30% of the image (where an overlaid
      // top-left control sits), scaled into the small sampling canvas.
      const sw = Math.max(1, Math.floor(img.naturalWidth * 0.45))
      const sh = Math.max(1, Math.floor(img.naturalHeight * 0.3))
      ctx.drawImage(img, 0, 0, sw, sh, 0, 0, cw, ch)
      const { data } = ctx.getImageData(0, 0, cw, ch)
      let sum = 0
      for (let i = 0; i < data.length; i += 4) {
        // Rec. 601 luma
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }
      const avg = sum / (data.length / 4)
      onLuminance(avg < 140)
    } catch {
      /* cross-origin or read failure — leave the caller's default */
    }
  }

  const onLoad = () => {
    setLoaded(true)
    sampleLuminance()
  }

  if (fill) {
    return (
      <div className={cn('absolute inset-0', className)}>
        <img
          src={low}
          alt=""
          aria-hidden
          className={cn('absolute inset-0 h-full w-full', fitClass, imgClassName)}
        />
        <img
          ref={fullRef}
          src={full}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={loading}
          crossOrigin={onLuminance ? 'anonymous' : undefined}
          onLoad={onLoad}
          className={cn(
            'absolute inset-0 h-full w-full transition-opacity duration-500 ease-out',
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
      <img
        src={low}
        alt=""
        aria-hidden
        className={cn('block w-full h-auto', fitClass, imgClassName)}
      />
      <img
        ref={fullRef}
        src={full}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={loading}
        crossOrigin={onLuminance ? 'anonymous' : undefined}
        onLoad={onLoad}
        className={cn(
          'absolute inset-0 w-full h-full transition-opacity duration-500 ease-out',
          fitClass,
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
      />
    </div>
  )
}
