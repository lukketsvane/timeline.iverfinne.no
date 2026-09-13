'use client'

import React, { useEffect, useRef } from 'react'

interface ModelViewerProps {
  src: string
  alt?: string
  poster?: string
  className?: string
  // Accepted and ignored: zoom and pan are never possible here at all.
  // model-viewer's own camera-controls stay off so the element never takes
  // pointer events, and the orbit is clamped to yaw. Callers (including the
  // MDX that Notion generates) still pass these, so they stay in the type.
  disableZoom?: boolean
  disablePan?: boolean
}

// The <model-viewer> element type lives in types/custom-elements.d.ts.

// The camera never moves on its own. Not on load, not on scroll, not on
// resize, not on a re-render — only a deliberate horizontal drag turns it.
//
// <model-viewer> auto-frames by default: `camera-target` resolves to the
// model's bounding-box centre and a `%` radius resolves against the framing
// distance it computes, and it recomputes both whenever the model loads or
// the element resizes. That is the automatic centring and zooming. We let it
// resolve those numbers exactly once, then pin them as explicit metre values
// so nothing can ever recompute them again.
const PITCH = '75deg'
// Starting distance, as a share of model-viewer's one-shot framing distance.
// >100% leaves breathing room instead of filling the frame edge to edge.
const FRAMING = 1.3

export function ModelViewer({ src, alt, poster, className }: ModelViewerProps) {
  const viewerRef = useRef<any>(null)
  // Yaw accumulator, moved by drags and by nothing else. Relative, so it
  // never snaps to an absolute value and never overrides the user.
  const theta = useRef(0)
  // Distance and target, in metres, once model-viewer has resolved them.
  const pinned = useRef<{ radius: number } | null>(null)
  const drag = useRef({ active: false, lastX: 0 })

  useEffect(() => {
    import('@google/model-viewer')
  }, [])

  const applyOrbit = () => {
    const el = viewerRef.current
    if (!el) return
    const radius = pinned.current ? `${pinned.current.radius}m` : `${FRAMING * 100}%`
    // Attribute (not property) so it works whether or not the custom element
    // has upgraded yet.
    el.setAttribute('camera-orbit', `${theta.current.toFixed(1)}deg ${PITCH} ${radius}`)
  }

  // Freeze the camera the moment the model is framed: read back the target
  // and distance model-viewer computed, write them as fixed values, and
  // clamp the orbit so only yaw can ever change.
  useEffect(() => {
    const el = viewerRef.current
    if (!el) return

    const freeze = () => {
      if (pinned.current) return
      const orbit = el.getCameraOrbit?.()
      const target = el.getCameraTarget?.()
      if (!orbit || !target) return

      const radius = Number((orbit.radius * FRAMING).toFixed(4))
      pinned.current = { radius }

      // An explicit target: no more bounding-box recentring, ever.
      el.setAttribute('camera-target', `${target.x}m ${target.y}m ${target.z}m`)
      // Pitch and distance locked; yaw left free for drags.
      el.setAttribute('min-camera-orbit', `-Infinity ${PITCH} ${radius}m`)
      el.setAttribute('max-camera-orbit', `Infinity ${PITCH} ${radius}m`)
      applyOrbit()
    }

    el.addEventListener('load', freeze)
    // A model already loaded before this effect ran still gets pinned.
    freeze()
    return () => el.removeEventListener('load', freeze)
  }, [src])

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
        camera-orbit={`0deg ${PITCH} ${FRAMING * 100}%`}
        // 0 = the camera jumps straight to where it is told. Any higher and
        // every change eases in, which reads as the camera drifting by itself.
        interpolation-decay="0"
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
