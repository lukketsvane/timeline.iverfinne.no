'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ImageGalleryProps {
  images: { src: string; alt: string }[]
  className?: string
  initialIndex?: number | null
  onIndexChange?: (index: number | null) => void
  syncHash?: boolean
  viewerOnly?: boolean
}

export function ImageGallery({ images = [], className, initialIndex = null, onIndexChange, syncHash = false, viewerOnly = false }: ImageGalleryProps) {
  const [internalIndex, setInternalIndex] = useState<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const selectedImage = initialIndex !== null ? initialIndex : internalIndex

  const setSelectedImage = useCallback((index: number | null) => {
    if (index !== null) {
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
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

  // Hash back/forward
  useEffect(() => {
    if (!syncHash) return
    const onHashChange = () => {
      const hash = window.location.hash
      if (hash) {
        const num = parseInt(hash.slice(1), 10)
        if (!isNaN(num) && num >= 1 && num <= images.length) {
          if (onIndexChange) onIndexChange(num - 1)
          else setInternalIndex(num - 1)
          setIsOpen(true)
        }
      } else {
        if (onIndexChange) onIndexChange(null)
        else setInternalIndex(null)
        setIsOpen(false)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [syncHash, images.length, onIndexChange])

  const goTo = useCallback((i: number) => {
    if (onIndexChange) onIndexChange(i)
    else setInternalIndex(i)
    if (syncHash) {
      window.history.replaceState(null, '', `${window.location.pathname}#${i + 1}`)
    }
  }, [onIndexChange, syncHash])

  const handlePrevious = useCallback((e?: any) => {
    e?.stopPropagation()
    if (selectedImage === null || !images?.length) return
    goTo((selectedImage - 1 + images.length) % images.length)
  }, [images?.length, selectedImage, goTo])

  const handleNext = useCallback((e?: any) => {
    e?.stopPropagation()
    if (selectedImage === null || !images?.length) return
    goTo((selectedImage + 1) % images.length)
  }, [images?.length, selectedImage, goTo])

  // Keyboard
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevious()
      else if (e.key === 'ArrowRight') handleNext()
      else if (e.key === 'Escape') setSelectedImage(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, handlePrevious, handleNext, setSelectedImage])

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Preload neighbors
  useEffect(() => {
    if (selectedImage === null || !images?.length) return
    for (const d of [-1, 1]) {
      const img = new Image()
      img.src = images[(selectedImage + d + images.length) % images.length].src
    }
  }, [selectedImage, images])

  // Touch swipe tracking (no framer-motion drag — just pointer events)
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragDir = useRef<'none' | 'x' | 'y'>('none')

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    touchStart.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    isDragging.current = false
    dragDir.current = 'none'
    setDragOffset({ x: 0, y: 0 })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!touchStart.current) return
    const dx = e.clientX - touchStart.current.x
    const dy = e.clientY - touchStart.current.y

    // Lock direction after 8px movement
    if (dragDir.current === 'none' && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      dragDir.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      isDragging.current = true
    }

    if (dragDir.current === 'x') {
      setDragOffset({ x: dx, y: 0 })
    } else if (dragDir.current === 'y') {
      setDragOffset({ x: 0, y: dy })
    }
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!touchStart.current) return
    const dx = e.clientX - touchStart.current.x
    const dy = e.clientY - touchStart.current.y
    const dt = Date.now() - touchStart.current.t
    const vx = Math.abs(dx) / Math.max(dt, 1) * 1000
    const vy = Math.abs(dy) / Math.max(dt, 1) * 1000

    // Vertical dismiss
    if (dragDir.current === 'y' && (Math.abs(dy) > 80 || vy > 600)) {
      setSelectedImage(null)
    }
    // Horizontal swipe
    else if (dragDir.current === 'x' && (Math.abs(dx) > 50 || vx > 400)) {
      if (dx > 0) handlePrevious()
      else handleNext()
    }

    touchStart.current = null
    isDragging.current = false
    dragDir.current = 'none'
    setDragOffset({ x: 0, y: 0 })
  }, [handlePrevious, handleNext, setSelectedImage])

  // Derived styles from drag
  const dragScale = 1 - Math.min(Math.abs(dragOffset.y) / 500, 0.15)
  const backdropOpacity = Math.max(0.15, 0.85 - Math.abs(dragOffset.y) / 350)

  if (!images || images.length === 0) return null

  return (
    <>
      {!viewerOnly && (
        <Card className={cn("w-full max-w-[100vw] overflow-hidden border-none bg-transparent shadow-none", className)}>
          <div className="relative w-full overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' as any }}>
            <div className="flex gap-4 w-max py-2 px-1">
              {images.map((image, index) => (
                <img
                  key={index}
                  src={image.src}
                  alt={image.alt}
                  onClick={(e) => { e.stopPropagation(); setSelectedImage(index) }}
                  className="h-[250px] sm:h-[350px] w-auto rounded-lg object-cover cursor-pointer hover:brightness-90 active:brightness-75 transition-[filter] duration-150"
                  style={{ maxWidth: 'min(800px, 85vw)' }}
                  draggable={false}
                />
              ))}
            </div>
          </div>
        </Card>
      )}

      <AnimatePresence>
        {isOpen && selectedImage !== null && (
          <motion.div
            key="viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ touchAction: 'none' }}
            onClick={() => setSelectedImage(null)}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              style={{ opacity: backdropOpacity, transition: isDragging.current ? 'none' : 'opacity 0.2s' }}
            />

            {/* Close */}
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedImage(null) }}
              className="absolute top-4 right-4 z-[110] p-3 text-white/50 hover:text-white"
              style={{ marginTop: 'max(8px, env(safe-area-inset-top))' }}
              aria-label="Lukk"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Desktop arrows */}
            <button onClick={handlePrevious} className="absolute left-4 top-1/2 -translate-y-1/2 z-[110] p-4 text-white/20 hover:text-white/80 hidden sm:block" aria-label="Førre">
              <ChevronLeft className="h-8 w-8" />
            </button>
            <button onClick={handleNext} className="absolute right-4 top-1/2 -translate-y-1/2 z-[110] p-4 text-white/20 hover:text-white/80 hidden sm:block" aria-label="Neste">
              <ChevronRight className="h-8 w-8" />
            </button>

            {/* Image — plain element, gesture via pointer events */}
            <img
              src={images[selectedImage].src}
              alt={images[selectedImage].alt}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClick={(e) => { e.stopPropagation(); if (!isDragging.current) return }}
              className="max-w-[95vw] max-h-[85vh] object-contain select-none relative z-[105] rounded-sm"
              style={{
                transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(${dragScale})`,
                transition: isDragging.current ? 'none' : 'transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              draggable={false}
            />

            {/* Dots + counter */}
            <div className="absolute z-[110] flex flex-col items-center gap-2" style={{ bottom: 'max(20px, env(safe-area-inset-bottom))' }}>
              {images.length <= 20 && (
                <div className="flex gap-1.5">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); goTo(i) }}
                      className={cn(
                        "rounded-full transition-all duration-200",
                        i === selectedImage ? "w-2 h-2 bg-white" : "w-1.5 h-1.5 bg-white/30"
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
