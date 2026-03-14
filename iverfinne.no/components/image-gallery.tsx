'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

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
  const selectedImage = initialIndex !== null ? initialIndex : internalIndex
  const isOpen = selectedImage !== null

  const close = useCallback(() => {
    if (onIndexChange) onIndexChange(null)
    else setInternalIndex(null)
    if (syncHash) {
      window.history.replaceState(null, '', window.location.pathname.replace(/\/$/, ''))
    }
  }, [onIndexChange, syncHash])

  const goTo = useCallback((i: number) => {
    if (onIndexChange) onIndexChange(i)
    else setInternalIndex(i)
    if (syncHash) {
      window.history.replaceState(null, '', `${window.location.pathname}#${i + 1}`)
    }
  }, [onIndexChange, syncHash])

  // Hash sync on mount
  useEffect(() => {
    if (!syncHash) return
    const hash = window.location.hash
    if (hash) {
      const num = parseInt(hash.slice(1), 10)
      if (!isNaN(num) && num >= 1 && num <= images.length) goTo(num - 1)
    }
  }, [syncHash, images.length])

  // Hash back/forward
  useEffect(() => {
    if (!syncHash) return
    const handler = () => {
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
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [syncHash, images.length, onIndexChange])

  const goPrev = useCallback((e?: any) => {
    e?.stopPropagation()
    if (selectedImage === null || !images?.length) return
    goTo((selectedImage - 1 + images.length) % images.length)
  }, [images?.length, selectedImage, goTo])

  const goNext = useCallback((e?: any) => {
    e?.stopPropagation()
    if (selectedImage === null || !images?.length) return
    goTo((selectedImage + 1) % images.length)
  }, [images?.length, selectedImage, goTo])

  // Keyboard
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, goPrev, goNext, close])

  // Lock scroll when open
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

  // Pointer-based swipe tracking
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const dir = useRef<'none' | 'x' | 'y'>('none')

  const onDown = useCallback((e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    dragging.current = false
    dir.current = 'none'
    setOffset({ x: 0, y: 0 })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!startRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (dir.current === 'none' && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      dir.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      dragging.current = true
    }
    if (dir.current === 'x') setOffset({ x: dx, y: 0 })
    else if (dir.current === 'y') setOffset({ x: 0, y: dy })
  }, [])

  const onUp = useCallback(() => {
    if (!startRef.current) return
    const { x: sx, y: sy, t } = startRef.current
    const dt = Math.max(Date.now() - t, 1)

    if (dir.current === 'y' && (Math.abs(offset.y) > 80 || Math.abs(offset.y) / dt * 1000 > 500)) {
      close()
    } else if (dir.current === 'x' && (Math.abs(offset.x) > 50 || Math.abs(offset.x) / dt * 1000 > 400)) {
      if (offset.x > 0) goPrev(); else goNext()
    }

    startRef.current = null
    dragging.current = false
    dir.current = 'none'
    setOffset({ x: 0, y: 0 })
  }, [offset, goPrev, goNext, close])

  const scale = 1 - Math.min(Math.abs(offset.y) / 500, 0.15)
  const bgAlpha = Math.max(0.4, 1 - Math.abs(offset.y) / 300)

  if (!images || images.length === 0) return null

  return (
    <>
      {/* Thumbnail strip */}
      {!viewerOnly && (
        <Card className={cn("w-full max-w-[100vw] overflow-hidden border-none bg-transparent shadow-none", className)}>
          <div className="relative w-full overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' as any }}>
            <div className="flex gap-4 w-max py-2 px-1">
              {images.map((image, index) => (
                <img
                  key={index}
                  src={image.src}
                  alt={image.alt}
                  onClick={(e) => { e.stopPropagation(); goTo(index) }}
                  className="h-[250px] sm:h-[350px] w-auto rounded-lg object-cover cursor-pointer hover:brightness-90 active:brightness-75 transition-[filter] duration-150"
                  style={{ maxWidth: 'min(800px, 85vw)' }}
                  draggable={false}
                />
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Fullscreen viewer — no AnimatePresence, no framer-motion on image */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ touchAction: 'none' }}
          onClick={close}
        >
          {/* Black background */}
          <div
            className="absolute inset-0 bg-black"
            style={{
              opacity: bgAlpha,
              transition: dragging.current ? 'none' : 'opacity 0.2s ease',
            }}
          />

          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); close() }}
            className="absolute top-4 right-4 z-[110] p-3 text-white/50 hover:text-white"
            style={{ marginTop: 'max(8px, env(safe-area-inset-top))' }}
            aria-label="Lukk"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Desktop arrows */}
          <button onClick={goPrev} className="absolute left-4 top-1/2 -translate-y-1/2 z-[110] p-4 text-white/20 hover:text-white/80 hidden sm:block" aria-label="Førre">
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button onClick={goNext} className="absolute right-4 top-1/2 -translate-y-1/2 z-[110] p-4 text-white/20 hover:text-white/80 hidden sm:block" aria-label="Neste">
            <ChevronRight className="h-8 w-8" />
          </button>

          {/* Image */}
          <img
            src={images[selectedImage].src}
            alt={images[selectedImage].alt}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[95vw] max-h-[85vh] object-contain select-none relative z-[105]"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: dragging.current ? 'none' : 'transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
              touchAction: 'none',
              userSelect: 'none',
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
        </div>
      )}
    </>
  )
}
