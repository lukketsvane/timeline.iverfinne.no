'use client'

import { useEffect } from 'react'

// iOS Safari ignores maximum-scale / user-scalable=no for pinch gestures (an
// accessibility choice since iOS 10). Cancelling its proprietary gesture
// events is what actually keeps the page at 1×. They are not scroll-blocking
// listeners, so scrolling stays on the fast path. Pointer events still
// arrive, so the image and 3D viewers keep their own pinch handling.
export function NoPageZoom() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault()
    const events = ['gesturestart', 'gesturechange', 'gestureend']
    events.forEach((t) => document.addEventListener(t, stop, { passive: false }))
    return () => events.forEach((t) => document.removeEventListener(t, stop))
  }, [])
  return null
}
