'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ImageGalleryProps {
  images: {
    src: string
    alt: string
  }[]
  className?: string
  initialIndex?: number | null
  onIndexChange?: (index: number | null) => void
  syncHash?: boolean
  viewerOnly?: boolean
}

export function ImageGallery({ images = [], className, initialIndex = null, onIndexChange, syncHash = false, viewerOnly = false }: ImageGalleryProps) {
  const [internalIndex, setInternalIndex] = useState<number | null>(null)

  const selectedImage = initialIndex !== null ? initialIndex : internalIndex
  const setSelectedImage = useCallback((index: number | null) => {
    if (onIndexChange) {
      onIndexChange(index)
    } else {
      setInternalIndex(index)
    }

    if (syncHash) {
      if (index !== null) {
        window.history.replaceState(null, '', `${window.location.pathname}#${index + 1}`)
      } else {
        window.history.replaceState(null, '', window.location.pathname.replace(/\/$/, ''))
      }
    }
  }, [onIndexChange, syncHash])

  // Read hash on mount to auto-open
  useEffect(() => {
    if (!syncHash) return
    const hash = window.location.hash
    if (hash) {
      const num = parseInt(hash.slice(1), 10)
      if (!isNaN(num) && num >= 1 && num <= images.length) {
        setSelectedImage(num - 1)
      }
    }
  }, [syncHash, images.length])

  // Listen for hash changes (back/forward)
  useEffect(() => {
    if (!syncHash) return
    const onHashChange = () => {
      const hash = window.location.hash
      if (hash) {
        const num = parseInt(hash.slice(1), 10)
        if (!isNaN(num) && num >= 1 && num <= images.length) {
          if (onIndexChange) onIndexChange(num - 1)
          else setInternalIndex(num - 1)
        }
      } else {
        if (onIndexChange) onIndexChange(null)
        else setInternalIndex(null)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [syncHash, images.length, onIndexChange])

  const handlePrevious = useCallback((e?: React.MouseEvent | any) => {
    if (!images || images.length === 0) return
    e?.stopPropagation()
    setSelectedImage(selectedImage !== null ? (selectedImage - 1 + images.length) % images.length : null)
  }, [images?.length, selectedImage, setSelectedImage])

  const handleNext = useCallback((e?: React.MouseEvent | any) => {
    if (!images || images.length === 0) return
    e?.stopPropagation()
    setSelectedImage(selectedImage !== null ? (selectedImage + 1) % images.length : null)
  }, [images?.length, selectedImage, setSelectedImage])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImage === null) return
      if (e.key === 'ArrowLeft') handlePrevious()
      else if (e.key === 'ArrowRight') handleNext()
      else if (e.key === 'Escape') setSelectedImage(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, handlePrevious, handleNext, setSelectedImage])

  useEffect(() => {
    if (selectedImage !== null) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [selectedImage])

  if (!images || images.length === 0) return null

  return (
    <>
      {!viewerOnly && (
        <Card className={cn("w-full max-w-[100vw] overflow-hidden border-none bg-transparent shadow-none", className)}>
          <div className="relative w-full overflow-x-auto scrollbar-hide">
            <div className="flex gap-4 w-max py-2 px-1">
              {images.map((image, index) => (
                <img
                  key={index}
                  src={image.src}
                  alt={image.alt}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedImage(index)
                  }}
                  className="h-[250px] sm:h-[350px] w-auto rounded-lg object-cover cursor-pointer transition-all hover:brightness-90"
                  style={{ maxWidth: 'min(800px, 85vw)' }}
                />
              ))}
            </div>
          </div>
        </Card>
      )}

      <AnimatePresence>
        {selectedImage !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
            onClick={() => setSelectedImage(null)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedImage(null) }}
              className="absolute top-6 right-6 z-[110] p-3 text-white/40 hover:text-white transition-colors"
              aria-label="Lukk"
            >
              <X className="h-6 w-6" />
            </button>

            <button
              onClick={handlePrevious}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-[110] p-4 text-white/20 hover:text-white/80 transition-colors hidden sm:block"
              aria-label="Førre"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>

            <button
              onClick={handleNext}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-[110] p-4 text-white/20 hover:text-white/80 transition-colors hidden sm:block"
              aria-label="Neste"
            >
              <ChevronRight className="h-8 w-8" />
            </button>

            <AnimatePresence mode="wait">
              <motion.img
                key={selectedImage}
                src={images[selectedImage].src}
                alt={images[selectedImage].alt}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
                className="max-w-[95vw] max-h-[90vh] object-contain select-none"
              />
            </AnimatePresence>

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-xs font-medium tracking-widest">
              {selectedImage + 1} / {images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
