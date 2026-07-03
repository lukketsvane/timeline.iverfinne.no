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
  // Yaw = scroll-derived angle + accumulated horizontal-drag offset.
  const scrollTheta = useRef(0)
  const dragTheta = useRef(0)
  const drag = useRef({ active: false, lastX: 0 })

  useEffect(() => {
    import('@google/model-viewer')
  }, [])

  const applyOrbit = () => {
    const el = viewerRef.current
    if (!el) return
    const theta = scrollTheta.current + dragTheta.current
    // Attribute (not property) so it works whether or not the custom element
    // has upgraded yet.
    el.setAttribute('camera-orbit', `${theta.toFixed(1)}deg ${PITCH} ${RADIUS}`)
  }

  // Scroll-driven rotation: the model faces front when the frame is centred
  // in the viewport and turns gently (±30°) as it moves up or down, so
  // scrolling itself is what spins the object.
  useEffect(() => {
    const el = viewerRef.current
    if (!el) return
    let raf = 0
    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.height === 0) return
      const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight
      scrollTheta.current = -offset * 60
      applyOrbit()
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
        dragTheta.current += (e.clientX - drag.current.lastX) * 0.4
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
        camera-orbit={`0deg ${PITCH} ${RADIUS}`}
        min-camera-orbit={`-Infinity ${PITCH} ${RADIUS}`}
        max-camera-orbit={`Infinity ${PITCH} ${RADIUS}`}
        shadow-intensity="1"
        shadow-softness="0.8"
        environment-image="neutral"
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
