'use client'

import { useEffect } from 'react'

// Registers the offline service worker (public/sw.js). Opened from the home
// screen, the site also asks it for a full offline copy — every post and
// image — so it can be shown anywhere, signal or not. In a normal browser tab
// it only keeps what has been viewed: no surprise downloads for visitors.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true

    const sync = () => {
      if (document.visibilityState !== 'visible') return
      navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'sync' }))
    }

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then(() => {
        if (!standalone) return
        // Ask iOS not to evict the offline copy under storage pressure.
        navigator.storage?.persist?.().catch(() => {})
        sync()
      })
      .catch(() => {})

    // iOS keeps the home-screen app alive in the background; top up the
    // copy each time it comes back to the front (the worker rate-limits).
    if (!standalone) return
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
  return null
}
