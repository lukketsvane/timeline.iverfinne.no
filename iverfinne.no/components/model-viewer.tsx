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

// Camera distance: 100% = model-viewer's auto framing. >100% zooms out so the
// object gets breathing room instead of filling the frame edge to edge.
const RADIUS = '130%'
const PITCH = '75deg'

export function ModelViewer({ src, alt, poster, className }: ModelViewerProps) {
  const viewerRef = useRef<any>(null)
  // Single yaw accumulator. Scroll deltas and horizontal drags both nudge it,
  // so the rotation is always relative — it never snaps to an absolute value
  // and user rotation is never overridden.
  const theta = useRef(0)
  const drag = useRef({ active: false, lastX: 0 })

  useEffect(() => {
    import('@google/model-viewer')
  }, [])

  const applyOrbit = () => {
    const el = viewerRef.current
    if (!el) return
    // Attribute (not property) so it works whether or not the custom element
    // has upgraded yet.
    el.setAttribute('camera-orbit', `${theta.current.toFixed(1)}deg ${PITCH} ${RADIUS}`)
  }

  // Scroll-driven rotation: each scrolled pixel nudges the yaw a little
  // (~30° per 600px), starting from the model's front view. Delta-based, so
  // scrolling away and back never resets what the user has rotated.
  useEffect(() => {
    let raf = 0
    let lastY = window.scrollY
    // Randomize the starting yaw a little (±30°) so multiple models on the
    // page don't stand perfectly aligned.
    theta.current += (Math.random() - 0.5) * 60
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const y = window.scrollY
        theta.current += (y - lastY) * 0.05
        lastY = y
        applyOrbit()
      })
    }
    applyOrbit()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    // The viewer must NEVER block vertical scrolling, so model-viewer's own
    // camera-controls are off (it never touches pointer events). We rotate the
    // model ourselves: touch-action pan-y hands every vertical gesture to the
    // browser's native scroll, while horizontal drags adjust the yaw. When a
    // vertical scroll takes over, the browser fires pointercancel and the
    // drag simply ends.
    <div
      className={`w-full bg-white rounded-lg overflow-hidden cursor-grab active:cursor-grabbing select-none ${className || 'aspect-square'}`}
      style={{ touchAction: 'pan-y' }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        drag.current = { active: true, lastX: e.clientX }
        ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current.active) return
        theta.current += (e.clientX - drag.current.lastX) * 0.4
        drag.current.lastX = e.clientX
        applyOrbit()
      }}
      onPointerUp={() => { drag.current.active = false }}
      onPointerCancel={() => { drag.current.active = false }}
    >
      <model-viewer
        ref={viewerRef}
        src={src}
        alt={alt || 'A 3D model'}
        autoplay
        camera-orbit={`0deg ${PITCH} ${RADIUS}`}
        min-camera-orbit={`-Infinity ${PITCH} ${RADIUS}`}
        max-camera-orbit={`Infinity ${PITCH} ${RADIUS}`}
        shadow-intensity="0"
        environment-image="/env/two-directional.hdr"
        tone-mapping="neutral"
        exposure="1"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#ffffff',
          pointerEvents: 'none',
          '--progress-bar-color': 'transparent',
          '--progress-bar-height': '0px',
          '--poster-color': 'transparent',
        } as React.CSSProperties}
        poster={poster}
        interaction-prompt="none"
      />
    </div>
  )
}

export default ModelViewer
