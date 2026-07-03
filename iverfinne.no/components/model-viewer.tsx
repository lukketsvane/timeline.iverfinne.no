'use client'

import React, { useEffect, useRef } from 'react'

interface ModelViewerProps {
  src: string
  alt?: string
  poster?: string
  disableZoom?: boolean
  disablePan?: boolean
  className?: string
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any
    }
  }
}

export function ModelViewer({ src, alt, poster, disableZoom, disablePan, className }: ModelViewerProps) {
  const viewerRef = useRef<any>(null)

  useEffect(() => {
    import('@google/model-viewer')
  }, [])

  // Scroll-driven rotation instead of auto-rotate: the model faces front when
  // the frame is centred in the viewport and turns gently (±30°) as it moves
  // up or down, so scrolling itself is what spins the object.
  useEffect(() => {
    const el = viewerRef.current
    if (!el) return
    let raf = 0
    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.height === 0) return
      const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight
      const theta = -offset * 60
      // Attribute (not property) so it works whether or not the custom
      // element has upgraded yet.
      el.setAttribute('camera-orbit', `${theta.toFixed(1)}deg 75deg auto`)
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      className={`w-full bg-white rounded-lg overflow-hidden ${className || 'aspect-square'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Orbit around the vertical axis only: pitch is pinned at the default
          75° while yaw stays free. Horizontal drags spin the model; vertical
          gestures fall through (touch-action pan-y) so the page can scroll.
          The --progress-bar vars hide model-viewer's built-in loading bar. */}
      <model-viewer
        ref={viewerRef}
        src={src}
        alt={alt || 'A 3D model'}
        camera-controls
        camera-orbit="0deg 75deg auto"
        disable-zoom={disableZoom ? '' : undefined}
        disable-pan={disablePan ? '' : undefined}
        min-camera-orbit="-Infinity 75deg auto"
        max-camera-orbit="Infinity 75deg auto"
        touch-action="pan-y"
        shadow-intensity="1"
        shadow-softness="0.8"
        environment-image="neutral"
        tone-mapping="neutral"
        exposure="1"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#ffffff',
          '--progress-bar-color': 'transparent',
          '--progress-bar-height': '0px',
          '--poster-color': 'transparent',
        } as React.CSSProperties}
        poster={poster}
        interaction-prompt="none"
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

        </div>
      </model-viewer>
    </div>
  )
}

export default ModelViewer
