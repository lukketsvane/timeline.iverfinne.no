'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn, notionImgSrc, notionImgSrcSet } from '@/lib/utils'

export interface LightboxItem {
  src: string
  alt?: string
  // Server-probed pixel size, when known. Without it the thumbnail or the
  // loaded image supplies the aspect ratio.
  w?: number
  h?: number
  // Optional chrome along the bottom edge, e.g. a link into the post.
  caption?: ReactNode
}

interface LightboxProps {
  items: LightboxItem[]
  // Index to open at; null keeps the viewer closed.
  startIndex: number | null
  onClose: () => void
  // The element the image grows out of and shrinks back into (the tapped
  // thumbnail). Its loaded <img> doubles as the instant placeholder.
  getThumb?: (index: number) => HTMLElement | null | undefined
}

// The one full-screen image viewer on the site (gallery, timeline cards,
// post pages, MDX galleries). Built for iPhone first:
//
// - Every gesture frame writes transforms straight to the DOM — React only
//   re-renders when the photo changes, so a drag never waits on a render.
// - Settling motion runs as Web Animations on transform/opacity, which the
//   compositor plays even while the main thread is busy decoding.
// - The neighbours are mounted beside the current photo, so a swipe drags
//   the next one in (no blank frame, no reload when the index changes).
// - Pull down/up to dismiss, pinch and double-tap to zoom, pan when zoomed.
//
// Deliberately not framer-motion: AnimatePresence bookkeeping broke on the
// remounting slides in the old viewers and left the overlay stuck open.
export function Lightbox({ startIndex, items, ...rest }: LightboxProps) {
  if (startIndex === null || items.length === 0 || typeof document === 'undefined') return null
  return createPortal(<LightboxView startIndex={startIndex} items={items} {...rest} />, document.body)
}

const GAP = 16 // px between neighbouring photos while swiping
const MAX_ZOOM = 4
const DOUBLE_TAP_ZOOM = 2.5
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const WIDTHS = [640, 960, 1280, 1600, 2048]

type Mode = 'idle' | 'pending' | 'swipe' | 'pull' | 'pan' | 'pinch'
type Pt = { x: number; y: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
// Past an edge, movement keeps following the finger at a third of the speed.
const rubber = (v: number, lo: number, hi: number) =>
  v > hi ? hi + (v - hi) * 0.35 : v < lo ? lo + (v - lo) * 0.35 : v
const zoomTransform = (s: number, x: number, y: number) => `translate3d(${x}px,${y}px,0) scale(${s})`

function thumbImg(el: HTMLElement | null | undefined): HTMLImageElement | null {
  if (!el) return null
  const img = el instanceof HTMLImageElement ? el : el.querySelector('img')
  return img && img.complete && img.naturalWidth > 0 ? img : null
}

function isVisible(r: DOMRect, w: number, h: number) {
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < h && r.right > 0 && r.left < w
}

// Matrix of an element as it is painted right now (mid-animation included).
function paintedMatrix(el: HTMLElement): DOMMatrixReadOnly {
  const t = getComputedStyle(el).transform
  return new DOMMatrixReadOnly(t && t !== 'none' ? t : undefined)
}

// Animate one property from its painted value to `to`. Resolves true when it
// ran to the end, false when something interrupted it.
function tween(el: HTMLElement | null, prop: 'transform' | 'opacity', to: string, ms: number): Promise<boolean> {
  if (!el) return Promise.resolve(false)
  const from = getComputedStyle(el)[prop]
  el.getAnimations().forEach((a) => a.cancel())
  el.style[prop] = to
  if (ms <= 0 || from === to) return Promise.resolve(true)
  return el
    .animate({ [prop]: [from, to] } as PropertyIndexedKeyframes, { duration: ms, easing: EASE })
    .finished.then(() => true, () => false)
}

function LightboxView({ items, startIndex, onClose, getThumb }: Omit<LightboxProps, 'startIndex'> & { startIndex: number }) {
  const [index, setIndex] = useState(() => clamp(startIndex, 0, items.length - 1))
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const [chrome, setChrome] = useState(true)
  const [hires, setHires] = useState<number | null>(null)
  const [ratios, setRatios] = useState<Record<number, number>>({})

  const rootRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const chromeRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const zoomEls = useRef(new Map<number, HTMLDivElement>())
  // Placeholders are read from the thumbnails once and then kept, so a slide
  // never swaps its placeholder mid-view.
  const placeholders = useRef(new Map<number, string | null>())

  // Gesture state. Lives in a ref: pointer moves never trigger a render.
  const g = useRef({
    mode: 'idle' as Mode,
    pointers: new Map<number, Pt>(),
    pointerType: 'touch',
    start: { x: 0, y: 0, t: 0 },
    base: { track: 0, s: 1, x: 0, y: 0 },
    samples: [] as { t: number; x: number; y: number }[],
    pinch: { d: 1, mx: 0, my: 0, s: 1, x: 0, y: 0 },
    mid: { mx: 0, my: 0 },
    track: 0,
    // Track offset to resume from once a mid-flight step has committed.
    rebase: 0,
    s: 1,
    x: 0,
    y: 0,
    lastTap: null as { t: number; x: number; y: number } | null,
    tapTimer: 0 as ReturnType<typeof setTimeout> | 0,
    closing: false,
  })

  const reduceMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ).current
  const ms = (n: number) => (reduceMotion ? 0 : n)

  const ratioOf = (i: number): number | undefined => {
    if (ratios[i]) return ratios[i]
    const it = items[i]
    if (it?.w && it?.h) return it.w / it.h
    const img = thumbImg(getThumb?.(i))
    return img ? img.naturalWidth / img.naturalHeight : undefined
  }

  // The photo's untransformed box: contained in the viewport, edge to edge
  // on a phone, with a margin on larger screens.
  const fit = (i: number) => {
    const pad = vp.w >= 768 ? 48 : 0
    const r = ratioOf(i) || 1.5
    const maxW = vp.w - pad * 2
    const maxH = vp.h - pad * 2
    let w = maxW
    let h = w / r
    if (h > maxH) {
      h = maxH
      w = h * r
    }
    return { w, h }
  }

  const placeholderOf = (i: number) => {
    if (!placeholders.current.has(i)) placeholders.current.set(i, thumbImg(getThumb?.(i))?.currentSrc || null)
    return placeholders.current.get(i) ?? null
  }

  const cur = () => zoomEls.current.get(index) ?? null

  const setTrack = (x: number) => {
    g.current.track = x
    if (trackRef.current) trackRef.current.style.transform = `translate3d(${x}px,0,0)`
  }
  const setZoom = (s: number, x: number, y: number) => {
    Object.assign(g.current, { s, x, y })
    const el = cur()
    if (el) el.style.transform = zoomTransform(s, x, y)
  }
  // Backdrop and chrome fade together while a pull-to-dismiss is under way.
  const setFade = (o: number) => {
    if (backdropRef.current) backdropRef.current.style.opacity = String(o)
    if (chromeRef.current) chromeRef.current.style.opacity = String(chrome ? o * o : 0)
  }

  const bounds = (s: number) => {
    const { w, h } = fit(index)
    return { bx: Math.max(0, (w * s - vp.w) / 2), by: Math.max(0, (h * s - vp.h) / 2) }
  }

  // Catch whatever is moving under the finger and hold it where it is.
  const freeze = (takeSteps = true) => {
    const st = g.current
    const t = trackRef.current
    if (t?.getAnimations().length) {
      let x = paintedMatrix(t).m41
      t.getAnimations().forEach((a) => a.cancel())
      // A step that is past halfway counts as taken, so a quick second flick
      // carries on from the next photo instead of redoing this one.
      const w = vp.w + GAP
      const dir = x < -w / 2 ? 1 : x > w / 2 ? -1 : 0
      if (takeSteps && dir && index + dir >= 0 && index + dir < items.length) {
        x += dir * w
        st.rebase = x
        setIndex(index + dir)
      }
      setTrack(x)
    }
    const el = cur()
    if (el?.getAnimations().length) {
      const m = paintedMatrix(el)
      el.getAnimations().forEach((a) => a.cancel())
      // Below 1× only happens mid open/snap-back animation: finish it.
      if (m.a < 0.999) setZoom(1, 0, 0)
      else setZoom(m.a, m.m41, m.m42)
    }
    const b = backdropRef.current
    if (b?.getAnimations().length) {
      b.getAnimations().forEach((a) => a.cancel())
      b.style.opacity = '1'
    }
    const c = chromeRef.current
    if (c?.getAnimations().length) {
      c.getAnimations().forEach((a) => a.cancel())
      c.style.opacity = chrome ? '1' : '0'
    }
  }

  // Step one photo left (-1) or right (+1); 0 springs back in place.
  const go = (dir: number) => {
    if (index + dir < 0 || index + dir > items.length - 1) dir = 0
    const target = -dir * (vp.w + GAP)
    g.current.track = target
    tween(trackRef.current, 'transform', `translate3d(${target}px,0,0)`, ms(dir ? 300 : 260)).then((done) => {
      if (done && dir) setIndex((i) => clamp(i + dir, 0, items.length - 1))
    })
  }

  const close = () => {
    const st = g.current
    if (st.closing) return
    freeze(false)
    st.closing = true
    clearTimeout(st.tapTimer)
    const el = cur()
    const d = ms(280)
    tween(backdropRef.current, 'opacity', '0', d)
    tween(chromeRef.current, 'opacity', '0', d * 0.6)

    // Fly back into the thumbnail when it can be seen. The backdrop is still
    // opaque at this point, so scrolling the page behind it to bring the
    // thumbnail into view (after swiping to another photo) is invisible.
    const thumb = getThumb?.(index)
    let r = thumb?.getBoundingClientRect()
    if (thumb && r && !isVisible(r, vp.w, vp.h)) {
      thumb.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
      r = thumb.getBoundingClientRect()
    }
    const box = el?.firstElementChild as HTMLElement | null
    if (el && r && isVisible(r, vp.w, vp.h)) {
      const { w, h } = fit(index)
      const s = Math.min(r.width / w, r.height / h)
      tween(el, 'transform', zoomTransform(s, r.left + r.width / 2 - vp.w / 2, r.top + r.height / 2 - vp.h / 2), d)
      // Hold the photo opaque until it has landed, then hand over to the
      // thumbnail underneath.
      box?.animate([{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: d, fill: 'forwards' })
    } else if (el) {
      const dir = st.y < 0 ? -1 : 1
      tween(el, 'transform', zoomTransform(st.s * 0.92, st.x, st.y + dir * vp.h * 0.15), d)
      box?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d, fill: 'forwards' })
    }
    setTimeout(onClose, d)
  }

  const zoomTo = (s: number, x: number, y: number, d = 320) => {
    const { bx, by } = bounds(s)
    x = clamp(x, -bx, bx)
    y = clamp(y, -by, by)
    Object.assign(g.current, { s, x, y })
    tween(cur(), 'transform', zoomTransform(s, x, y), ms(d))
    if (s > 1.2) setHires(index)
  }

  // Release after a pinch: back inside 1×–MAX and inside the panning bounds.
  const settleZoom = () => {
    const st = g.current
    if (st.s <= 1.02) return zoomTo(1, 0, 0)
    if (st.s > MAX_ZOOM) {
      const k = MAX_ZOOM / st.s
      return zoomTo(MAX_ZOOM, st.mid.mx - (st.mid.mx - st.x) * k, st.mid.my - (st.mid.my - st.y) * k)
    }
    zoomTo(st.s, st.x, st.y)
  }

  const toggleZoomAt = (px: number, py: number) => {
    if (g.current.s > 1.01) return zoomTo(1, 0, 0)
    // Keep the tapped point under the finger: t = p · (1 − S).
    const mx = px - vp.w / 2
    const my = py - vp.h / 2
    zoomTo(DOUBLE_TAP_ZOOM, mx * (1 - DOUBLE_TAP_ZOOM), my * (1 - DOUBLE_TAP_ZOOM))
  }

  const onPhoto = (x: number, y: number) => {
    const r = cur()?.getBoundingClientRect()
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }

  const tap = (x: number, y: number, pointerType: string) => {
    const st = g.current
    // Mouse: click the left/right half of the photo to step, outside to close.
    if (pointerType === 'mouse') {
      if (!onPhoto(x, y)) return close()
      const r = cur()!.getBoundingClientRect()
      return go(x < r.left + r.width / 2 ? -1 : 1)
    }
    // Touch: double-tap zooms; a single tap toggles the chrome on the photo
    // and closes on the black around it. The single tap waits out the
    // double-tap window.
    const now = performance.now()
    const last = st.lastTap
    if (last && now - last.t < 300 && Math.hypot(x - last.x, y - last.y) < 40) {
      clearTimeout(st.tapTimer)
      st.lastTap = null
      return toggleZoomAt(x, y)
    }
    st.lastTap = { t: now, x, y }
    st.tapTimer = setTimeout(() => {
      st.lastTap = null
      if (st.s > 1.01 || onPhoto(x, y)) api.current.toggleChrome()
      else api.current.close()
    }, 260)
  }

  // Velocity (px/ms) over the last ~100ms of movement.
  const velocity = () => {
    const s = g.current.samples
    if (s.length < 2) return { vx: 0, vy: 0 }
    const a = s[0]
    const b = s[s.length - 1]
    // The finger stopped before lifting: no fling.
    if (performance.now() - b.t > 60) return { vx: 0, vy: 0 }
    const dt = Math.max(b.t - a.t, 1)
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt }
  }

  const beginSingle = (p: Pt) => {
    const st = g.current
    st.mode = 'pending'
    st.start = { x: p.x, y: p.y, t: performance.now() }
    st.base = { track: st.track, s: st.s, x: st.x, y: st.y }
    st.samples = [{ t: st.start.t, x: p.x, y: p.y }]
  }

  const beginPinch = () => {
    const st = g.current
    // A second finger cancels a swipe or pull that was already under way.
    if (st.mode === 'swipe') go(0)
    if (st.mode === 'pull') {
      setZoom(st.base.s, st.base.x, st.base.y)
      setFade(1)
    }
    const [a, b] = [...st.pointers.values()]
    const mx = (a.x + b.x) / 2 - vp.w / 2
    const my = (a.y + b.y) / 2 - vp.h / 2
    st.mode = 'pinch'
    st.mid = { mx, my }
    st.pinch = { d: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1), mx, my, s: st.s, x: st.x, y: st.y }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const st = g.current
    if (st.closing) return
    if ((e.target as Element).closest('a,button')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    rootRef.current?.setPointerCapture(e.pointerId)
    if (st.pointers.size === 0) freeze()
    st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    st.pointerType = e.pointerType
    if (st.pointers.size === 1) beginSingle({ x: e.clientX, y: e.clientY })
    else if (st.pointers.size === 2) beginPinch()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const st = g.current
    const p = st.pointers.get(e.pointerId)
    if (!p || st.closing) return
    p.x = e.clientX
    p.y = e.clientY

    if (st.mode === 'pinch') {
      const [a, b] = [...st.pointers.values()]
      if (!b) return
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const mx = (a.x + b.x) / 2 - vp.w / 2
      const my = (a.y + b.y) / 2 - vp.h / 2
      let s = (st.pinch.s * d) / st.pinch.d
      if (s > MAX_ZOOM) s = MAX_ZOOM + (s - MAX_ZOOM) * 0.25
      if (s < 1) s = Math.max(0.5, 1 - (1 - s) * 0.5)
      // Keep the content point that started under the fingers under them.
      const k = s / st.pinch.s
      st.mid = { mx, my }
      setZoom(s, mx - (st.pinch.mx - st.pinch.x) * k, my - (st.pinch.my - st.pinch.y) * k)
      return
    }
    if (st.pointers.size !== 1) return

    const now = performance.now()
    st.samples.push({ t: now, x: e.clientX, y: e.clientY })
    while (st.samples.length > 2 && now - st.samples[0].t > 100) st.samples.shift()

    const dx = e.clientX - st.start.x
    const dy = e.clientY - st.start.y
    if (st.mode === 'pending') {
      if (Math.hypot(dx, dy) < 8) return
      st.mode = st.base.s > 1.01 ? 'pan' : Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'pull'
    }

    if (st.mode === 'swipe') {
      let x = st.base.track + dx
      if ((index === 0 && x > 0) || (index === items.length - 1 && x < 0)) x *= 0.3
      setTrack(x)
    } else if (st.mode === 'pull') {
      const progress = Math.min(1, Math.abs(dy) / (vp.h * 0.45))
      setZoom(1 - 0.25 * Math.min(1, Math.abs(dy) / vp.h), st.base.x + dx, st.base.y + dy)
      setFade(1 - progress)
    } else if (st.mode === 'pan') {
      const { bx, by } = bounds(st.s)
      setZoom(st.s, rubber(st.base.x + dx, -bx, bx), rubber(st.base.y + dy, -by, by))
    }
  }

  const onPointerEnd = (e: React.PointerEvent) => {
    const st = g.current
    if (!st.pointers.has(e.pointerId)) return
    st.pointers.delete(e.pointerId)
    const cancelled = e.type === 'pointercancel'
    if (st.closing) return

    if (st.mode === 'pinch') {
      if (st.pointers.size === 1) {
        // One finger stays down: carry on as a pan from where it is.
        beginSingle([...st.pointers.values()][0])
        st.mode = 'pan'
      } else if (st.pointers.size === 0) {
        st.mode = 'idle'
        settleZoom()
      }
      return
    }
    if (st.pointers.size > 0) return

    const mode = st.mode
    st.mode = 'idle'
    const { vx, vy } = velocity()

    if (mode === 'pending') {
      if (!cancelled && performance.now() - st.start.t < 500) tap(e.clientX, e.clientY, st.pointerType)
    } else if (mode === 'swipe') {
      const x = st.track
      const w = vp.w + GAP
      let dir = 0
      if (!cancelled && x < 0 && (x < -w * 0.2 || vx < -0.35)) dir = 1
      else if (!cancelled && x > 0 && (x > w * 0.2 || vx > 0.35)) dir = -1
      go(dir)
    } else if (mode === 'pull') {
      const y = st.y
      if (!cancelled && (Math.abs(y) > 90 || (Math.abs(vy) > 0.5 && Math.sign(vy) === Math.sign(y)))) {
        close()
      } else {
        Object.assign(st, { s: 1, x: 0, y: 0 })
        tween(cur(), 'transform', zoomTransform(1, 0, 0), ms(320))
        tween(backdropRef.current, 'opacity', '1', ms(220))
        tween(chromeRef.current, 'opacity', chrome ? '1' : '0', ms(220))
      }
    } else if (mode === 'pan') {
      // Glide on in the direction of the flick, then come to rest in bounds.
      if (st.s <= 1.02) return settleZoom()
      const { bx, by } = bounds(st.s)
      zoomTo(st.s, clamp(st.x + vx * 180, -bx, bx), clamp(st.y + vy * 180, -by, by), 420)
    }
  }

  // Latest closures for timers and window listeners.
  const api = useRef({ close, go, toggleChrome: () => setChrome((c) => !c) })
  api.current = { close, go, toggleChrome: () => setChrome((c) => !c) }

  // New photo: the slides have just re-rendered at their new offsets, so the
  // track snaps back to 0 in the same frame (no flicker), and every slide
  // drops any zoom it had.
  const firstIndex = useRef(true)
  useLayoutEffect(() => {
    if (firstIndex.current) {
      firstIndex.current = false
      return
    }
    trackRef.current?.getAnimations().forEach((a) => a.cancel())
    setTrack(g.current.rebase)
    g.current.rebase = 0
    zoomEls.current.forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel())
      el.style.transform = zoomTransform(1, 0, 0)
    })
    Object.assign(g.current, { s: 1, x: 0, y: 0 })
    setHires(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // Open: grow out of the thumbnail (or fade up when there is none), lock
  // the page behind, focus the close button.
  useLayoutEffect(() => {
    const el = cur()
    const thumb = getThumb?.(index)
    const r = thumb?.getBoundingClientRect()
    const d = ms(320)
    if (backdropRef.current) backdropRef.current.style.opacity = '0'
    if (chromeRef.current) chromeRef.current.style.opacity = '0'
    if (el && r && isVisible(r, vp.w, vp.h)) {
      const { w, h } = fit(index)
      const s = Math.min(r.width / w, r.height / h)
      el.style.transform = zoomTransform(s, r.left + r.width / 2 - vp.w / 2, r.top + r.height / 2 - vp.h / 2)
    } else if (el) {
      el.style.transform = zoomTransform(0.94, 0, 0)
      ;(el.firstElementChild as HTMLElement | null)?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: d })
    }
    tween(el, 'transform', zoomTransform(1, 0, 0), d)
    tween(backdropRef.current, 'opacity', '1', ms(240))
    tween(chromeRef.current, 'opacity', '1', ms(240))

    const html = document.documentElement
    const scrollbar = window.innerWidth - html.clientWidth
    const prev = { overflow: html.style.overflow, padding: document.body.style.paddingRight }
    html.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
    const focused = document.activeElement as HTMLElement | null
    closeBtnRef.current?.focus({ preventScroll: true })
    return () => {
      html.style.overflow = prev.overflow
      document.body.style.paddingRight = prev.padding
      clearTimeout(g.current.tapTimer)
      focused?.focus?.({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Chrome toggle (single tap on the photo).
  const firstChrome = useRef(true)
  useEffect(() => {
    if (firstChrome.current) {
      firstChrome.current = false
      return
    }
    tween(chromeRef.current, 'opacity', chrome ? '1' : '0', ms(180))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chrome])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') api.current.close()
      else if (e.key === 'ArrowLeft') api.current.go(-1)
      else if (e.key === 'ArrowRight') api.current.go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Rotation / resize: re-fit and drop any zoom.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const ro = new ResizeObserver(() => {
      const w = root.clientWidth
      const h = root.clientHeight
      setVp((v) => (v.w === w && v.h === h ? v : { w, h }))
    })
    ro.observe(root)
    return () => ro.disconnect()
  }, [])
  const firstVp = useRef(true)
  useLayoutEffect(() => {
    if (firstVp.current) {
      firstVp.current = false
      return
    }
    setTrack(0)
    setZoom(1, 0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp])

  // Warm the cache two photos out, at the width the slide will ask for.
  useEffect(() => {
    for (const i of [index - 2, index + 2]) {
      const it = items[i]
      if (!it) continue
      const img = new Image()
      img.sizes = `${Math.round(fit(i).w)}px`
      const set = notionImgSrcSet(it.src, WIDTHS)
      if (set) img.srcset = set
      img.src = notionImgSrc(it.src, 1280)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const item = items[index]
  const slides = [index - 1, index, index + 1].filter((i) => i >= 0 && i < items.length)
  const iconBtn =
    'pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60'

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={item.alt || 'Bilete'}
      className="fixed inset-0 z-[200] select-none overflow-hidden overscroll-none"
      style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div ref={backdropRef} className="absolute inset-0 bg-black" />
      <div ref={trackRef} className="absolute inset-0">
        {slides.map((i) => (
          <Slide
            key={i}
            item={items[i]}
            offset={i - index}
            vpw={vp.w}
            box={fit(i)}
            placeholder={placeholderOf(i)}
            hires={hires === i}
            setEl={(el) => {
              if (el) zoomEls.current.set(i, el)
              else zoomEls.current.delete(i)
            }}
            onRatio={(r) => {
              const known = ratioOf(i)
              if (!known || Math.abs(known - r) / r > 0.01) setRatios((m) => ({ ...m, [i]: r }))
            }}
          />
        ))}
      </div>

      <div
        ref={chromeRef}
        className={cn('pointer-events-none absolute inset-0 text-white', !chrome && '[&_*]:!pointer-events-none')}
      >
        <div
          className="absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/50 to-transparent px-2 pb-6"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <span className="px-3 py-3.5 text-xs tabular-nums text-white/70">
            {items.length > 1 ? `${index + 1} / ${items.length}` : ''}
          </span>
          <button ref={closeBtnRef} type="button" onClick={() => close()} aria-label="Lukk" className={iconBtn}>
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Arrows on hover-capable screens; phones swipe. */}
        {index > 0 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Førre"
            className={cn(iconBtn, 'absolute left-3 top-1/2 hidden -translate-y-1/2 bg-black/30 [@media(hover:hover)]:flex')}
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}
        {index < items.length - 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Neste"
            className={cn(iconBtn, 'absolute right-3 top-1/2 hidden -translate-y-1/2 bg-black/30 [@media(hover:hover)]:flex')}
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}

        {item.caption && (
          <div
            className="pointer-events-auto absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pt-12"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            {item.caption}
          </div>
        )}
      </div>
    </div>
  )
}

function Slide({ item, offset, vpw, box, placeholder, hires, setEl, onRatio }: {
  item: LightboxItem
  offset: number
  vpw: number
  box: { w: number; h: number }
  placeholder: string | null
  hires: boolean
  setEl: (el: HTMLDivElement | null) => void
  onRatio: (r: number) => void
}) {
  const [loaded, setLoaded] = useState(false)
  // The placeholder stays underneath until the full image has finished
  // fading in, so there is never a dark frame between the two.
  const [shown, setShown] = useState(false)
  const [hiresLoaded, setHiresLoaded] = useState(false)
  const proxied = item.src.startsWith('/api/notion-image?')
  const imgClass = 'absolute inset-0 h-full w-full object-contain'

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ transform: `translate3d(${offset * (vpw + GAP)}px,0,0)` }}
      aria-hidden={offset !== 0}
    >
      <div ref={setEl} className="relative shrink-0 will-change-transform" style={{ width: box.w, height: box.h }}>
        <div className="absolute inset-0">
          {placeholder && !shown && <img src={placeholder} alt="" aria-hidden className={imgClass} draggable={false} />}
          <img
            src={notionImgSrc(item.src, 1280)}
            srcSet={notionImgSrcSet(item.src, WIDTHS)}
            sizes={`${Math.round(box.w)}px`}
            alt={item.alt || ''}
            decoding="async"
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget
              if (img.naturalWidth && img.naturalHeight) onRatio(img.naturalWidth / img.naturalHeight)
              // Decode off the main thread before showing it, so swapping the
              // placeholder for the full image never stalls a swipe.
              ;(img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => setLoaded(true))
            }}
            onTransitionEnd={() => loaded && setShown(true)}
            className={cn(imgClass, 'transition-opacity duration-200', loaded || !placeholder ? 'opacity-100' : 'opacity-0')}
          />
          {/* Zoomed in: layer the largest variant on top once it's ready. */}
          {hires && proxied && (
            <img
              src={notionImgSrc(item.src, 2048)}
              alt=""
              aria-hidden
              decoding="async"
              draggable={false}
              onLoad={() => setHiresLoaded(true)}
              className={cn(imgClass, 'transition-opacity duration-200', hiresLoaded ? 'opacity-100' : 'opacity-0')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
