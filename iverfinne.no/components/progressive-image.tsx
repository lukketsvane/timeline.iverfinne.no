'use client'

import { useState } from 'react'
import { notionImgSrc, notionImgSrcSet } from '@/lib/utils'

interface ProgressiveImageProps {
  src: string
  alt: string
  srcSetWidths: number[]
  sizes: string
  className?: string
}

// Loads a tiny (24px) version first — through the proxy's own resizer, so it
// arrives in a few KB regardless of the source image's size — and shows it
// blurred immediately. The full-resolution image loads in behind it and
// crossfades in once ready, so the hero never blocks on the big transform.
export function ProgressiveImage({ src, alt, srcSetWidths, sizes, className = '' }: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative">
      <img
        src={notionImgSrc(src, 24)}
        alt=""
        aria-hidden="true"
        className={`${className} scale-105 blur-lg transition-opacity duration-300 ${loaded ? 'opacity-0' : 'opacity-100'}`}
      />
      <img
        src={notionImgSrc(src, srcSetWidths[srcSetWidths.length - 1])}
        srcSet={notionImgSrcSet(src, srcSetWidths)}
        sizes={sizes}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={`${className} absolute inset-0 transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}
