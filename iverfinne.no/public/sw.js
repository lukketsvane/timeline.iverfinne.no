/* iverfinne.no service worker — keeps the site usable without a network.
 *
 * Every visitor gets runtime caching: pages, scripts and images they have
 * seen are kept, and served when the network is gone or crawling.
 *
 * The home-screen app (display-mode: standalone, see
 * components/service-worker.tsx) also asks for a full sync: every post page,
 * every image at one phone-sized width, 3D models, and every script those
 * pages need. It can then show any post with no signal at all.
 *
 * Kill switch: replace this file with one that deletes its caches and calls
 * self.registration.unregister(). Browsers re-check it on every page load.
 */

const PAGES = 'pages-v1'
const STATIC = 'static-v1'
const MEDIA = 'media-v1'
const DATA = 'data-v1'
const META = 'meta-v1'
const OURS = [PAGES, STATIC, MEDIA, DATA, META]

// Past this, a page or flight request gives up and the cache answers.
const NETWORK_TIMEOUT = 2500
// Image width kept for offline use: sharp full-screen on a phone.
const OFFLINE_WIDTH = 1280
const IMAGE_ACCEPT = 'image/avif,image/webp,image/*,*/*;q=0.8'
// A full sync at most this often (each one only fetches what is missing)…
const SYNC_EVERY = 30 * 60 * 1000
// …and stored pages are re-fetched once they are this old.
const PAGE_MAX_AGE = 24 * 60 * 60 * 1000
// Caches that have never been fully synced are trimmed, oldest first, to
// these sizes.
const RUNTIME_LIMIT = { [STATIC]: 800, [MEDIA]: 1200 }

const MEDIA_FILE = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|glb|gltf|hdr)$/i

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!OURS.includes(key)) await caches.delete(key)
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Streaming media (the logo videos, audio) uses range requests; leave those
  // to the browser.
  if (req.headers.has('range')) return
  if (url.pathname === '/sw.js' || url.pathname === '/api/offline-manifest') return

  if (req.mode === 'navigate') return event.respondWith(page(event))
  if (req.headers.get('rsc') === '1' || url.searchParams.has('_rsc')) return event.respondWith(flight(req))
  if (url.pathname.startsWith('/_next/static/')) return event.respondWith(staticFile(req))
  if (url.pathname === '/api/notion-image' || url.pathname === '/_next/image' || MEDIA_FILE.test(url.pathname)) {
    return event.respondWith(media(req))
  }
  if (url.pathname.startsWith('/api/posts/')) return event.respondWith(data(req))
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'sync') event.waitUntil(sync())
})

// ── Strategies ──────────────────────────────────────────────────────────────

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms, null))

// Network, unless it fails or takes longer than `ms`: then null.
const fetchWithin = (req, ms, init) =>
  Promise.race([fetch(req, init).catch(() => null), timeout(ms)])

// Pages: network first, so a new post or deploy shows up at once. The stored
// copy answers when the network fails, is too slow, or the server errors.
// A slow answer still lands in the cache for next time.
async function page(event) {
  const req = event.request
  const key = pageKey(req.url)
  const network = fetch(req).then(async (res) => {
    if (isStorableHtml(res)) await put(PAGES, key, res.clone())
    return res
  })
  event.waitUntil(network.catch(() => {}))
  const cached = await caches.match(key, { cacheName: PAGES })
  if (!cached) return network.catch(() => offlinePage())
  const res = await Promise.race([network.catch(() => null), timeout(NETWORK_TIMEOUT)])
  // Any real answer below 500 goes through as is — including Vercel's
  // security check, which must run for the site to keep working.
  return res && res.status < 500 ? res : cached
}

// React Server Component payloads (client-side navigation). Never stored:
// each depends on the router state that asked for it. Failing fast instead
// makes Next fall back to a full page load, which page() can serve.
async function flight(req) {
  return (await fetchWithin(req, NETWORK_TIMEOUT)) || Response.error()
}

// Hashed build output never changes: cache first. The query (deployment id)
// does not change the file.
async function staticFile(req) {
  const hit = await caches.match(req, { cacheName: STATIC, ignoreSearch: true })
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok && res.type === 'basic') put(STATIC, req, res.clone())
  return res
}

// Images, models and public files: cache first. Offline, a request for a size
// that was never fetched gets any stored size of the same image instead of a
// broken one.
async function media(req) {
  const hit = await caches.match(req, { cacheName: MEDIA, ignoreVary: true })
  if (hit) return hit
  const res = await fetch(req).catch(() => null)
  if (res && res.ok && res.type === 'basic') {
    put(MEDIA, req, res.clone())
    return res
  }
  return (await anySize(req.url)) || res || Response.error()
}

// Post bodies for "Les meir" cards: network first, stored copy as fallback.
async function data(req) {
  const res = await fetchWithin(req, NETWORK_TIMEOUT * 2)
  if (res && res.ok) {
    put(DATA, req, res.clone())
    return res
  }
  return (await caches.match(req, { cacheName: DATA })) || res || Response.error()
}

function offlinePage() {
  const html = `<!doctype html><html lang="nn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Fråkopla</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;text-align:center;font:16px/1.5 system-ui,sans-serif;color:#111;background:#fff}a{color:inherit}</style></head><body><div><p>Du er fråkopla, og denne sida er ikkje lagra på telefonen enno.</p><p><a href="/">Til forsida</a></p></div></body></html>`
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function pageKey(url) {
  const u = new URL(url, self.location.origin)
  return u.origin + u.pathname
}

function isStorableHtml(res) {
  return (
    res.ok &&
    res.type === 'basic' &&
    !res.redirected &&
    (res.headers.get('Content-Type') || '').includes('text/html')
  )
}

let writes = 0
async function put(cacheName, key, res) {
  try {
    const cache = await caches.open(cacheName)
    await cache.put(key, res)
    if (cacheName === MEDIA) sizeIndex = null
  } catch {
    /* quota or a body that can't be stored: just don't keep it */
  }
  // Visitors who never sync (a normal browser tab) still get a ceiling.
  if (++writes % 100 === 0 && !(await readState()).complete) {
    for (const [name, max] of Object.entries(RUNTIME_LIMIT)) await trim(name, max)
  }
}

// Worth another try later (offline, timed out, server trouble), as opposed
// to a definite answer such as a 404 for a deleted image.
const transient = (res) => !res || res.status >= 500 || res.status === 429

// The same image at another width: /api/notion-image?block=…&w=640 and
// …&w=1280 (or /_next/image?url=…&w=…&q=…) share everything but w/q.
function sizeless(url) {
  const u = new URL(url, self.location.origin)
  u.searchParams.delete('w')
  u.searchParams.delete('q')
  return u.href
}

let sizeIndex = null // sizeless url → [{ req, w }], rebuilt after writes
async function anySize(url) {
  const cache = await caches.open(MEDIA)
  if (!sizeIndex) {
    sizeIndex = new Map()
    for (const r of await cache.keys()) {
      const k = sizeless(r.url)
      const w = Number(new URL(r.url).searchParams.get('w')) || Infinity
      if (!sizeIndex.has(k)) sizeIndex.set(k, [])
      sizeIndex.get(k).push({ req: r, w })
    }
  }
  const all = sizeIndex.get(sizeless(url))
  if (!all) return null
  const best = all.reduce((a, b) => (b.w > a.w ? b : a))
  return cache.match(best.req, { ignoreVary: true })
}

// Build output referenced from HTML, JS or CSS. Next writes these as
// "/_next/static/…" in HTML and as "static/chunks/…" inside its runtime.
const STATIC_REF = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[\w\-.~@%/]+?\.(?:js|css|woff2?|ttf|otf|png|jpe?g|svg|webp|avif|gif|wasm)(?![\w.])/g
function staticRefs(text) {
  const out = new Set()
  for (const m of text.matchAll(STATIC_REF)) {
    out.add('/_next/' + m[0].replace(/^\/?(?:_next\/)?/, ''))
  }
  return out
}

// Proxied images a page shows (attributes and the inline RSC payload, where
// they also sit inside markdown as "(…)"). The manifest lists them too; this
// catches any it can't see. Block ids are checked so stray text never turns
// into a request.
function mediaRefs(html) {
  const out = new Set()
  for (const m of html.matchAll(/\/api\/notion-image\?[^"'\s<>\\()]+/g)) {
    const src = m[0].replace(/&amp;/g, '&')
    const block = new URL(src, self.location.origin).searchParams.get('block')
    if (block === null || /^[0-9a-f-]{32,36}$/i.test(block)) out.add(src)
  }
  return out
}

// Run `fn` over `items`, `n` at a time.
async function pool(items, n, fn) {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(n, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift())
    })
  )
}

async function readState() {
  const res = await caches.match('/__offline-sync', { cacheName: META })
  return res ? res.json() : {}
}
async function writeState(state) {
  await put(META, '/__offline-sync', new Response(JSON.stringify(state), { headers: { 'Content-Type': 'application/json' } }))
}

// Oldest entries go first (Cache keys come back in insertion order).
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(k)
}

// ── Full sync (home-screen app only) ────────────────────────────────────────

let syncing = null
function sync() {
  if (!syncing) syncing = runSync().catch(() => {}).finally(() => { syncing = null })
  return syncing
}

// Idempotent and resumable: only what is missing or stale is fetched, so a
// sync cut short (the app closed, the signal dropped) carries on next time.
// `complete` (no transient failures) only sets the pace: an incomplete copy
// is topped up the next time the app comes to the front.
async function runSync() {
  const state = await readState()
  if (state.complete && Date.now() - state.at < SYNC_EVERY) return

  const res = await fetch('/api/offline-manifest', { cache: 'no-store' })
  if (!res.ok) return
  const manifest = await res.json()
  const origin = self.location.origin
  const abs = (p) => new URL(p, origin).href

  const pageCache = await caches.open(PAGES)
  const staticCache = await caches.open(STATIC)
  const mediaCache = await caches.open(MEDIA)
  const refreshPages = !state.pagesAt || Date.now() - state.pagesAt > PAGE_MAX_AGE
  let complete = true

  // 1. Pages, and the build files their HTML points at.
  const pageKeys = new Set(manifest.pages.map(pageKey))
  const needed = new Set()
  const shown = new Set()
  await pool([...pageKeys], 3, async (key) => {
    let res = refreshPages ? null : await pageCache.match(key)
    if (!res) {
      const fresh = await fetch(key).catch(() => null)
      if (fresh && isStorableHtml(fresh)) {
        await pageCache.put(key, fresh.clone())
        res = fresh
      } else {
        if (transient(fresh)) complete = false
        res = await pageCache.match(key)
      }
    }
    if (!res) return
    const html = await res.text()
    for (const ref of staticRefs(html)) needed.add(ref)
    for (const ref of mediaRefs(html)) shown.add(ref)
  })

  // 2. Build files, following the chunks scripts load later on (lazy
  //    components such as the 3D viewer) until nothing new turns up.
  const seen = new Set()
  let frontier = [...needed]
  while (frontier.length) {
    const next = []
    await pool(frontier, 6, async (path) => {
      if (seen.has(path)) return
      seen.add(path)
      let file = await staticCache.match(path, { ignoreSearch: true })
      if (!file) {
        const fresh = await fetch(path).catch(() => null)
        if (!fresh || !fresh.ok) return void (transient(fresh) && (complete = false))
        await staticCache.put(path, fresh.clone())
        file = fresh
      }
      if (/\.(?:js|css)$/.test(path)) {
        for (const ref of staticRefs(await file.text())) if (!seen.has(ref)) next.push(ref)
      }
    })
    frontier = next
  }

  // 3. Images at the offline width; models and other files as they are. One
  //    copy per image: the first listing of it wins (files before images, so
  //    a 3D model is never fetched twice under two keys).
  const wantedMedia = new Map() // sizeless url → url to keep
  const want = (url) => wantedMedia.has(sizeless(url)) || wantedMedia.set(sizeless(url), url)
  const atOfflineWidth = (src) => {
    const u = new URL(src, origin)
    if (u.pathname === '/api/notion-image') u.searchParams.set('w', String(OFFLINE_WIDTH))
    return u.href
  }
  manifest.files.filter((f) => !f.startsWith('/api/posts/')).forEach((f) => want(abs(f)))
  manifest.images.forEach((src) => want(atOfflineWidth(src)))
  shown.forEach((src) => want(atOfflineWidth(src)))
  await pool([...wantedMedia.values()], 4, async (url) => {
    if (await mediaCache.match(url, { ignoreVary: true })) return
    const fresh = await fetch(url, { headers: { Accept: IMAGE_ACCEPT } }).catch(() => null)
    if (fresh && fresh.ok && fresh.type === 'basic') await mediaCache.put(url, fresh)
    else if (transient(fresh)) complete = false
  })
  sizeIndex = null

  // 4. Expandable post bodies.
  const dataCache = await caches.open(DATA)
  await pool(manifest.files.filter((f) => f.startsWith('/api/posts/')).map(abs), 3, async (url) => {
    if (!refreshPages && (await dataCache.match(url))) return
    const fresh = await fetch(url).catch(() => null)
    if (fresh && fresh.ok) await dataCache.put(url, fresh)
    else if (transient(fresh)) complete = false
  })

  // 5. Drop what the site no longer has: unpublished posts, images that left
  //    them, and build files no stored page needs (earlier deploys). Safe
  //    after failed fetches too: what is wanted is never dropped, and a page
  //    that could not be fetched keeps its stored copy and that copy's files.
  for (const k of await pageCache.keys()) if (!pageKeys.has(pageKey(k.url))) await pageCache.delete(k)
  for (const k of await staticCache.keys()) if (!seen.has(new URL(k.url).pathname)) await staticCache.delete(k)
  for (const k of await mediaCache.keys()) if (!wantedMedia.has(sizeless(k.url))) await mediaCache.delete(k)
  sizeIndex = null

  await writeState({
    at: Date.now(),
    pagesAt: refreshPages && complete ? Date.now() : state.pagesAt,
    complete,
  })
}
