'use client'

import { useRef, useState } from 'react'
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Lightbox } from '@/components/lightbox'

interface ImageGalleryProps {
  images: { src: string; alt: string }[]
  className?: string
}

// <ImageGallery> in post MDX: a horizontal thumbnail strip that opens the
// shared full-screen viewer.
export function ImageGallery({ images = [], className }: ImageGalleryProps) {
  const [open, setOpen] = useState<number | null>(null)
  const thumbs = useRef<(HTMLImageElement | null)[]>([])

  if (!images || images.length === 0) return null

  return (
    <>
      <Card className={cn("w-full max-w-full overflow-hidden border-none bg-transparent shadow-none", className)}>
        <div className="relative w-full overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' as any }}>
          <div className="flex gap-4 w-max py-2 px-1">
            {images.map((image, index) => (
              <img
                key={index}
                ref={(el) => { thumbs.current[index] = el }}
                src={image.src}
                alt={image.alt}
                loading="lazy"
                onClick={(e) => { e.stopPropagation(); setOpen(index) }}
                className="h-[250px] sm:h-[350px] w-auto rounded-lg object-cover cursor-pointer hover:brightness-90 active:brightness-75 transition-[filter] duration-150"
                style={{ maxWidth: 'min(800px, 85vw)' }}
                draggable={false}
              />
            ))}
          </div>
        </div>
      </Card>
      <Lightbox items={images} startIndex={open} onClose={() => setOpen(null)} getThumb={(i) => thumbs.current[i]} />
    </>
  )
}
