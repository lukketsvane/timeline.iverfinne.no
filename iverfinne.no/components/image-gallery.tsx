'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'

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
  const [imgOpacity, setImgOpacity] = useState(1)
  const transitioning = useRef(false)

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

  // Hash sync on mount
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

  // Hash sync on back/forward
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

  // Navigate with crossfade — no remounting
  const navigateTo = useCallback((newIndex: number) => {
    if (transitioning.current || !images || images.length === 0) return
    transitioning.current = true
    setImgOpacity(0)
    setTimeout(() => {
      setSelectedImage(newIndex)
      // Let the new src load, then fade in
      requestAnimationFrame(() => {
        setImgOpacity(1)
        transitioning.current = false
      })
    }, 80)
  }, [images, setSelectedImage])

  const handlePrevious = useCallback((e?: any) => {
    e?.stopPropagation()
    if (selectedImage === null || !images?.length) return
    navigateTo((selectedImage - 1 + images.length) % images.length)
  }, [images?.length, selectedImage, navigateTo])

  const handleNext = useCallback((e?: any) => {
    e?.stopPropagation()
    if (selectedImage === null || !images?.length) return
    navigateTo((selectedImage + 1) % images.length)
  }, [images?.length, selectedImage, navigateTo])

  // Keyboard nav
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

  // Lock body scroll
  useEffect(() => {
    if (selectedImage !== null) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [selectedImage])

  // Preload adjacent images
  useEffect(() => {
    if (selectedImage === null || !images?.length) return
    const preload = (i: number) => {
      const idx = (i + images.length) % images.length
      const img = new Image()
      img.src = images[idx].src
    }
    preload(selectedImage - 1)
    preload(selectedImage + 1)
  }, [selectedImage, images])

  // Pan gesture tracking
  const panX = useMotionValue(0)
  const panY = useMotionValue(0)
  const bgOpacity = useTransform(panY, [-250, 0, 250], [0.2, 1, 0.2])
  const imgScale = useTransform(panY, [-250, 0, 250], [0.88, 1, 0.88])

  // Reset pan values when image changes or viewer closes
  useEffect(() => {
    panX.set(0)
    panY.set(0)
  }, [selectedImage, panX, panY])

  const handlePanEnd = useCallback((_: any, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
    if (transitioning.current) return
    const { offset, velocity } = info

    // Vertical dismiss
    if (Math.abs(offset.y) > 100 || Math.abs(velocity.y) > 400) {
      // Animate out then dismiss
      animate(panY, offset.y > 0 ? 500 : -500, { duration: 0.2 })
      animate(panX, 0, { duration: 0.15 })
      setTimeout(() => setSelectedImage(null), 150)
      return
    }

    // Horizontal swipe
    if (Math.abs(offset.x) > 40 || Math.abs(velocity.x) > 300) {
      // Snap back pan position then navigate
      animate(panX, 0, { duration: 0.1 })
      animate(panY, 0, { duration: 0.1 })
      if (offset.x > 0) {
        handlePrevious()
      } else {
        handleNext()
      }
      return
    }

    // Not enough — snap back
    animate(panX, 0, { type: 'spring', stiffness: 500, damping: 30 })
    animate(panY, 0, { type: 'spring', stiffness: 500, damping: 30 })
  }, [handlePrevious, handleNext, setSelectedImage, panX, panY])

  if (!images || images.length === 0) return null

  return (
    <>
      {!viewerOnly && (
        <Card className={cn("w-full max-w-[100vw] overflow-hidden border-none bg-transparent shadow-none", className)}>
          <div className="relative w-full overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                  className="h-[250px] sm:h-[350px] w-auto rounded-lg object-cover cursor-pointer active:scale-[0.97] hover:brightness-90"
                  style={{ maxWidth: 'min(800px, 85vw)', transition: 'transform 0.15s ease' }}
                  draggable={false}
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
            className="fixed inset-0 z-[100] flex items-center justify-center"
            onClick={() => setSelectedImage(null)}
            style={{ touchAction: 'none' }}
          >
            {/* Background — responds to vertical drag */}
            <motion.div className="absolute inset-0 bg-black" style={{ opacity: bgOpacity }} />

            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedImage(null) }}
              className="absolute top-4 right-4 z-[110] p-3 text-white/50 hover:text-white active:text-white/80"
              style={{ marginTop: 'max(8px, env(safe-area-inset-top))' }}
              aria-label="Lukk"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Desktop nav arrows */}
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-[110] p-4 text-white/20 hover:text-white/80 hidden sm:block"
              aria-label="Førre"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-[110] p-4 text-white/20 hover:text-white/80 hidden sm:block"
              aria-label="Neste"
            >
              <ChevronRight className="h-8 w-8" />
            </button>

            {/* Single image — no AnimatePresence, no remounting */}
            <motion.img
              src={images[selectedImage].src}
              alt={images[selectedImage].alt}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.6}
              onDragEnd={handlePanEnd}
              style={{
                x: panX,
                y: panY,
                scale: imgScale,
                opacity: imgOpacity,
                touchAction: 'none',
                transition: `opacity 0.08s ease`,
              }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-[95vw] max-h-[85vh] object-contain select-none relative z-[105] rounded-sm"
              draggable={false}
            />

            {/* Dots + counter */}
            <div
              className="absolute z-[110] flex flex-col items-center gap-2"
              style={{ bottom: 'max(20px, env(safe-area-inset-bottom))' }}
            >
              {images.length <= 20 && (
                <div className="flex gap-1.5">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation()
                        navigateTo(i)
                      }}
                      className={cn(
                        "rounded-full transition-all duration-200",
                        i === selectedImage
                          ? "w-2 h-2 bg-white"
                          : "w-1.5 h-1.5 bg-white/30"
                      )}
                    />
                  ))}
                </div>
              )}
              <span className="text-white/40 text-xs font-medium tracking-widest tabular-nums">
                {selectedImage + 1} / {images.length}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
