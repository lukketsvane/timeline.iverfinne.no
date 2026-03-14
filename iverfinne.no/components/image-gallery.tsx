'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { motion, AnimatePresence, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion'

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
  const [direction, setDirection] = useState(0)

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
    setDirection(-1)
    setSelectedImage(selectedImage !== null ? (selectedImage - 1 + images.length) % images.length : null)
  }, [images?.length, selectedImage, setSelectedImage])

  const handleNext = useCallback((e?: React.MouseEvent | any) => {
    if (!images || images.length === 0) return
    e?.stopPropagation()
    setDirection(1)
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

  // Swipe / drag-to-dismiss
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)
  const bgOpacity = useTransform(dragY, [-300, 0, 300], [0.3, 1, 0.3])
  const scale = useTransform(dragY, [-300, 0, 300], [0.85, 1, 0.85])

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const { offset, velocity } = info
    const swipeThreshold = 50
    const velocityThreshold = 300

    // Vertical drag to dismiss
    if (Math.abs(offset.y) > 120 || Math.abs(velocity.y) > velocityThreshold) {
      setSelectedImage(null)
      return
    }

    // Horizontal swipe to navigate
    if (Math.abs(offset.x) > swipeThreshold || Math.abs(velocity.x) > velocityThreshold) {
      if (offset.x > 0 || velocity.x > velocityThreshold) {
        handlePrevious()
      } else {
        handleNext()
      }
    }
  }, [handlePrevious, handleNext, setSelectedImage])

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '40%' : '-40%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-40%' : '40%',
      opacity: 0,
    }),
  }

  if (!images || images.length === 0) return null

  return (
    <>
      {!viewerOnly && (
        <Card className={cn("w-full max-w-[100vw] overflow-hidden border-none bg-transparent shadow-none", className)}>
          <div className="relative w-full overflow-x-auto scrollbar-hide -webkit-overflow-scrolling-touch">
            <div className="flex gap-4 w-max py-2 px-1">
              {images.map((image, index) => (
                <img
                  key={index}
                  src={image.src}
                  alt={image.alt}
                  onClick={(e) => {
                    e.stopPropagation()
                    setDirection(0)
                    setSelectedImage(index)
                  }}
                  className="h-[250px] sm:h-[350px] w-auto rounded-lg object-cover cursor-pointer transition-all active:scale-[0.97] hover:brightness-90"
                  style={{ maxWidth: 'min(800px, 85vw)' }}
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
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            onClick={() => setSelectedImage(null)}
            style={{ touchAction: 'none' }}
          >
            {/* Background with drag-responsive opacity */}
            <motion.div
              className="absolute inset-0 bg-black"
              style={{ opacity: bgOpacity }}
            />

            <button
              onClick={(e) => { e.stopPropagation(); setSelectedImage(null) }}
              className="absolute top-[env(safe-area-inset-top,12px)] right-4 z-[110] p-3 text-white/50 hover:text-white active:text-white transition-colors"
              style={{ marginTop: 'max(12px, env(safe-area-inset-top))' }}
              aria-label="Lukk"
            >
              <X className="h-6 w-6" />
            </button>

            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-[110] p-4 text-white/20 hover:text-white/80 transition-colors hidden sm:block"
              aria-label="Førre"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>

            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-[110] p-4 text-white/20 hover:text-white/80 transition-colors hidden sm:block"
              aria-label="Neste"
            >
              <ChevronRight className="h-8 w-8" />
            </button>

            <AnimatePresence mode="popLayout" custom={direction} initial={false}>
              <motion.img
                key={selectedImage}
                src={images[selectedImage].src}
                alt={images[selectedImage].alt}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 350, damping: 35, mass: 0.8 },
                  opacity: { duration: 0.2 },
                }}
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={{ left: 0.7, right: 0.7, top: 0.5, bottom: 0.5 }}
                onDragEnd={handleDragEnd}
                style={{ x: dragX, y: dragY, scale, touchAction: 'none' }}
                onClick={(e) => e.stopPropagation()}
                className="max-w-[95vw] max-h-[85vh] object-contain select-none relative z-[105] rounded-sm"
                draggable={false}
              />
            </AnimatePresence>

            {/* Bottom counter + dots */}
            <div
              className="absolute z-[110] flex flex-col items-center gap-2"
              style={{ bottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              {images.length <= 20 && (
                <div className="flex gap-1.5">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDirection(i > selectedImage ? 1 : -1)
                        setSelectedImage(i)
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
