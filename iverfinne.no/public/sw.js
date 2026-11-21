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
// A full sync at most this often (each one only fetches what is missing),
// or this often to fill the gaps after one that hit network trouble…
const SYNC_EVERY = 30 * 60 * 1000
const RETRY_EVERY = 5 * 60 * 1000
// …and stored pages are re-fetched once they are this old.
const PAGE_MAX_AGE = 24 * 60 * 60 * 1000
// A stored image is refreshed in the background once it is this old (a
// replaced cover or image block keeps its URL).
const MEDIA_MAX_AGE = 24 * 60 * 60 * 1000
// On a miss, a stored image of another size answers if the network has not
// within this long.
const MEDIA_TIMEOUT = 1500
// Caches of browsers that have never synced (a normal tab) are trimmed,
// oldest first, to these sizes.
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
    return event.respondWith(media(event))
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

// Set when a flight request just timed out: the network is crawling, so the
// full page load Next falls back to takes the stored copy straight away.
let slowUntil = 0

// Pages: network first, so a new post or deploy shows up at once. The stored
// copy answers when the network fails, is too slow, or the server errors.
// The response streams straight through; storing it happens alongside, and
// a slow answer still lands in the cache for next time.
async function page(event) {
  const req = event.request
  const key = pageKey(req.url)
  let stored = Promise.resolve()
  const network = fetch(req).then((res) => {
    if (isStorableHtml(res)) stored = put(PAGES, key, res.clone())
    return res
  })
  event.waitUntil(network.then(() => stored, () => {}))
  const cached = await caches.match(key, { cacheName: PAGES })
  if (!cached) return network.catch(() => offlinePage())
  const wait = Date.now() < slowUntil ? 0 : NETWORK_TIMEOUT
  const res = await Promise.race([network.catch(() => null), timeout(wait)])
  // Any real answer below 500 goes through as is — including Vercel's
  // security check, which must run for the site to keep working.
  return res && res.status < 500 ? res : cached
}

// React Server Component payloads (client-side navigation). Never stored:
// each depends on the router state that asked for it. When a stored copy of
// the page exists, a slow answer is cut short: Next then falls back to a
// full page load, which page() serves from that copy. Without one, waiting
// is the only way to get there, so the request is left alone.
async function flight(req) {
  if (!(await caches.match(pageKey(req.url), { cacheName: PAGES }))) return fetch(req)
  const res = await fetchWithin(req, NETWORK_TIMEOUT)
  if (res) return res
  slowUntil = Date.now() + 15000
  return Response.error()
}

// Build files fetched while this worker has been running: the open page may
// still need them, so a sync never prunes them.
const recentStatic = new Set()

// Hashed build output never changes: cache first. The query (deployment id)
// does not change the file.
async function staticFile(req) {
  const hit = await caches.match(req, { cacheName: STATIC, ignoreSearch: true })
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok && res.type === 'basic') {
    recentStatic.add(new URL(req.url).pathname)
    put(STATIC, req, res.clone())
  }
  return res
}

// Images, models and public files: cache first, refreshed in the background
// once a day old. On a miss, the network gets MEDIA_TIMEOUT before a stored
// copy of the same image at another size answers (offline: at once) — the
// sync keeps one size, pages ask for several.
async function media(event) {
  const req = event.request
  const hit = await caches.match(req, { cacheName: MEDIA, ignoreVary: true })
  if (hit) {
    if (age(hit) > MEDIA_MAX_AGE) fetchInto(event, MEDIA, req).catch(() => {})
    return hit
  }
  const net = fetchInto(event, MEDIA, req).catch(() => null)
  const other = await anySize(req.url)
  if (!other) return (await net) || Response.error()
  const res = await Promise.race([net, timeout(MEDIA_TIMEOUT)])
  return res && res.ok ? res : other
}

// Post bodies for "Les meir" cards: network first. Only cut short when a
// stored copy can answer instead — a cold body can take a while to build.
async function data(req) {
  const stored = await caches.match(req, { cacheName: DATA })
  const res = stored ? await fetchWithin(req, NETWORK_TIMEOUT * 2) : await fetch(req).catch(() => null)
  if (res && res.ok) {
    put(DATA, req, res.clone())
    return res
  }
  return stored || res || Response.error()
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

const age = (res) => Date.now() - (Date.parse(res.headers.get('Date') || '') || Date.now())

// Fetch, keeping a copy of a whole same-origin success. The response comes
// back as soon as it arrives; storing it runs alongside, kept alive by the
// event.
function fetchInto(event, cacheName, req) {
  let stored = Promise.resolve()
  const res = fetch(req).then((r) => {
    if (r.ok && r.type === 'basic') stored = put(cacheName, req, r.clone())
    return r
  })
  event.waitUntil(res.then(() => stored, () => {}))
  return res
}

let writes = 0
async function put(cacheName, key, res) {
  try {
    const cache = await caches.open(cacheName)
    await cache.put(key, res)
    if (cacheName === MEDIA) indexSize(typeof key === 'string' ? key : key.url)
    // A browser that has never synced (a normal tab) still gets a ceiling.
    // Once the home-screen app has synced, nothing it keeps is trimmed.
    if (++writes % 100 === 0 && !(await readState()).started) {
      for (const [name, max] of Object.entries(RUNTIME_LIMIT)) await trim(name, max)
    }
  } catch {
    /* quota or a body that can't be stored: just don't keep it */
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

// sizeless url → [{ url, w }] for every stored image. Built once (a single
// shared build, however many requests miss at the same moment), kept up to
// date by put(), dropped after bulk changes (sync, trim).
let sizeIndex = null
function addSize(map, url) {
  const k = sizeless(url)
  const w = Number(new URL(url).searchParams.get('w')) || Infinity
  if (!map.has(k)) map.set(k, [])
  const list = map.get(k)
  if (!list.some((e) => e.url === url)) list.push({ url, w })
}
function indexSize(url) {
  if (sizeIndex) sizeIndex = sizeIndex.then((map) => (addSize(map, url), map))
}
async function anySize(url) {
  const cache = await caches.open(MEDIA)
  if (!sizeIndex) {
    sizeIndex = cache.keys().then((keys) => {
      const map = new Map()
      for (const r of keys) addSize(map, r.url)
      return map
    })
  }
  const all = (await sizeIndex).get(sizeless(url))
  if (!all) return null
  const best = all.reduce((a, b) => (b.w > a.w ? b : a))
  return cache.match(best.url, { ignoreVary: true })
}

// Build output referenced from HTML, JS or CSS. Next writes these as
// "/_next/static/…" in HTML and as "static/chunks/…" inside its runtime;
// stylesheets point at fonts relatively, as url(../media/….woff2).
const STATIC_REF = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[\w\-.~@%/]+?\.(?:js|css|woff2?|ttf|otf|png|jpe?g|svg|webp|avif|gif|wasm)(?![\w.])/g
function staticRefs(text, from) {
  const out = new Set()
  for (const m of text.matchAll(STATIC_REF)) {
    out.add('/_next/' + m[0].replace(/^\/?(?:_next\/)?/, ''))
  }
  if (from && from.endsWith('.css')) {
    for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      if (/^(?:data:|https?:|\/\/)/.test(m[1])) continue
      const path = new URL(m[1], self.location.origin + from).pathname
      if (path.startsWith('/_next/static/')) out.add(path)
    }
  }
  return out
}

// Proxied images a page shows (attributes and the inline RSC payload, where
// they also sit inside markdown as "(…)"). The manifest lists them too; this
// catches any it can't see. Block ids are checked so stray text never turns
// into a request.
function mediaRefs(html) {
  const out = new Set()
  // The inline payload escapes "&" as \u0026 and may escape "/" as \/.
  const text = html.replace(/\\u0026/g, '&').replace(/\\\//g, '/')
  for (const m of text.matchAll(/\/api\/notion-image\?[^"'\s<>\\()]+/g)) {
    const src = m[0].replace(/&amp;/g, '&')
    const q = new URL(src, self.location.origin).searchParams
    const block = q.get('block')
    const ok = block !== null ? /^[0-9a-f-]{32,36}$/i.test(block) : q.has('url') || (q.has('page') && (q.has('type') || q.has('prop')))
    if (ok) out.add(src)
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
  // Paced by the last finished sync, or by the last attempt — an attempt
  // cut short (iOS suspends a backgrounded app) still counts.
  if (state.complete && Date.now() - state.at < SYNC_EVERY) return
  if (Date.now() - Math.max(state.at || 0, state.tried || 0) < RETRY_EVERY) return
  await writeState({ ...state, started: state.started || Date.now(), tried: Date.now() })

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
  // Record the page refresh now, so a run cut short later does not fetch
  // every page again next time.
  if (refreshPages) {
    state.pagesAt = Date.now()
    await writeState({ ...state, started: state.started || Date.now(), tried: Date.now() })
  }

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
        for (const ref of staticRefs(await file.text(), path)) if (!seen.has(ref)) next.push(ref)
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
  //    them, and build files of earlier deploys. Safe after failed fetches
  //    too: what is wanted is never dropped, and a page that could not be
  //    fetched keeps its stored copy and that copy's files. Build files are
  //    kept one sync longer than the pages that used them, and never while
  //    the open page may still load them (recentStatic).
  const keepStatic = new Set([...seen, ...(state.static || []), ...recentStatic])
  for (const k of await pageCache.keys()) if (!pageKeys.has(pageKey(k.url))) await pageCache.delete(k)
  for (const k of await staticCache.keys()) if (!keepStatic.has(new URL(k.url).pathname)) await staticCache.delete(k)
  for (const k of await mediaCache.keys()) if (!wantedMedia.has(sizeless(k.url))) await mediaCache.delete(k)
  sizeIndex = null

  await writeState({
    started: state.started || Date.now(),
    at: Date.now(),
    tried: Date.now(),
    // Advanced even after a partial run: pages that failed keep their stored
    // copy, and are refreshed whenever they are opened online anyway.
    pagesAt: state.pagesAt,
    static: [...seen],
    complete,
  })
}
