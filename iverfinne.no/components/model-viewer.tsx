'use client'

import React, { useEffect } from 'react'

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
  useEffect(() => {
    import('@google/model-viewer')
  }, [])

  return (
    <div
      className={`w-full bg-white rounded-lg overflow-hidden ${className || 'aspect-square'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <model-viewer
        src={src}
        alt={alt || 'A 3D model'}
        auto-rotate
        camera-controls
        disable-zoom={disableZoom ? '' : undefined}
        disable-pan={disablePan ? '' : undefined}
        shadow-intensity="1"
        shadow-softness="0.8"
        environment-image="neutral"
        tone-mapping="neutral"
        exposure="1"
        style={{ width: '100%', height: '100%', backgroundColor: '#ffffff' }}
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
