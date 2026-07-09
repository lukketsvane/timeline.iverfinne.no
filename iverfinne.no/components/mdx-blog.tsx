'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Search, ChevronDown } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { motion } from 'framer-motion'
import { cn } from "@/lib/utils"
import { MDXCard } from "./mdx-card"
import GalleryView from "./gallery-view"
import Skissebok from "./skissebok"
import OmMeg from "./om-meg"
import type { MDXRemoteSerializeResult } from 'next-mdx-remote'
import { getTagColor } from "@/lib/tag-utils"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Post {
  uid: string
  id?: string
  title: string
  description: string
  date: string
  tags: string[] | string | undefined
  slug: string
  type: "Skriving" | "Bok" | "Prosjekt" | "Lenkje" | "Interaktiv" | "Bilete" | "Presentasjon"
  image?: string
  coverimage?: string
  content: string
  serialized?: MDXRemoteSerializeResult
  url?: string
  icon?: string
  thumbnails?: { src: string; alt: string }[]
  modelSrc?: string
  lesMeir?: boolean
}

const contentTypes = [
  { label: "Skriving", value: "Skriving" },
  { label: "Bok", value: "Bok" },
  { label: "Prosjekt", value: "Prosjekt" },
  { label: "Lenkje", value: "Lenkje" },
  { label: "Interaktiv", value: "Interaktiv" },
  { label: "Bilete", value: "Bilete" },
  { label: "Presentasjon", value: "Presentasjon" },
]

interface FilterButtonProps {
  label: string
  isActive: boolean
  onClick: () => void
  variant?: "type" | "tag" | "default"
}

// Solid, full-colour fill per type — used for the always-on filter pills.
const typeColorMap: Record<string, string> = {
  Skriving: "bg-blue-500",
  Bok: "bg-green-500",
  Prosjekt: "bg-cyan-500",
  Lenkje: "bg-orange-500",
  Interaktiv: "bg-pink-500",
  Bilete: "bg-teal-500",
  Presentasjon: "bg-indigo-500",
}

const FilterButton = ({ label, isActive, onClick, variant = "default" }: FilterButtonProps) => {
  const color = getTagColor(label)

  const baseStyles = "text-xs px-3 py-1 h-auto font-normal transition-all"
  const typeColor = typeColorMap[label]
  const variantStyles = {
    type: cn(
      "rounded-full border-0",
      // Selected = full colour; unselected = light grey. No outline.
      isActive
        ? cn(typeColor || "bg-gray-500", "text-white")
        : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
    ),
    tag: cn(
      "rounded-sm border",
      isActive
        ? color
        : "bg-white dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-800 hover:border-gray-300"
    ),
    default: "bg-gray-100/50 hover:bg-gray-200/50 text-gray-600 rounded-full"
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        baseStyles,
        variantStyles[variant]
      )}
    >
      {label}
    </Button>
  )
}

interface MDXBlogProps {
  initialPosts?: Post[]
  initialType?: string
  // Set to '404' when rendered from the not-found route: reveals (and selects)
  // the hidden "404" tab so a mistyped URL lands inside the app, not a bare page.
  initialView?: 'timeline' | 'gallery' | 'om' | '404'
  // Pins the 404 game (set by the /404-blokk and /404-kloss routes). Without it, a
  // game is picked at random client-side so the choice isn't baked into the
  // statically-prerendered 404.
  initialGame?: GameKey
}

// The two standalone games, each with its own route and 404-tab colour.
// Tapping the 404 tab while it's already active toggles between them.
const GAMES = {
  blokk: { name: 'bl.okk', url: 'https://blokk.iverfinne.no', tabColor: 'bg-neutral-800' },
  kloss: { name: 'kl.oss', url: 'https://kloss.iverfinne.no', tabColor: 'bg-red-500' },
} as const
export type GameKey = keyof typeof GAMES

export default function MDXBlog({ initialPosts = [], initialType, initialView, initialGame }: MDXBlogProps) {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [search, setSearch] = useState("")
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    initialType ? [contentTypes.find(t => t.value.toLowerCase() === initialType.toLowerCase())?.value || ""].filter(Boolean) : []
  )
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
  // Years collapsed via their timeline pill — posts from these years are hidden.
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'timeline' | 'gallery' | 'skissebok' | 'om' | '404'>(initialView || 'timeline')
  const [filtersOpen, setFiltersOpen] = useState(false)
  // The "404" tab stays hidden until the visitor first discovers it (by hitting
  // a dead URL). After that it sticks around so they can come back to the game.
  const [found404, setFound404] = useState(false)
  const [game, setGame] = useState<GameKey | null>(initialGame ?? null)

  useEffect(() => {
    const already = typeof window !== 'undefined' && localStorage.getItem('found404') === '1'
    if (initialView === '404') {
      localStorage.setItem('found404', '1')
      setFound404(true)
    } else if (already) {
      setFound404(true)
    }
  }, [initialView])

  // Pick a game only once the 404 tab is actually viewed (avoids loading the
  // iframe for everyone), and keep the choice stable for the session. Runs in
  // an effect, not render, so the statically-prerendered 404 stays neutral.
  useEffect(() => {
    if (view === '404' && !game) {
      setGame(Math.random() < 0.5 ? 'blokk' : 'kloss')
    }
  }, [view, game])

  // The Skissebok tab turns the whole page dark — paint html + body so the
  // colour reaches the safe-area / overscroll edges, not just the container.
  useEffect(() => {
    const dark = view === 'skissebok'
    const html = document.documentElement
    html.style.transition = 'background-color 0.7s ease'
    document.body.style.transition = 'background-color 0.7s ease'
    html.style.backgroundColor = dark ? '#0a0a0a' : ''
    document.body.style.backgroundColor = dark ? '#0a0a0a' : ''
    return () => {
      html.style.backgroundColor = ''
      document.body.style.backgroundColor = ''
    }
  }, [view])

  // Each tab starts at the top — carrying a deep timeline scroll offset into
  // the gallery (or back) is disorienting.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  const uniqueTags = useMemo(() => {
    const tagSet = new Set<string>()
    posts.forEach(post => {
      if (Array.isArray(post.tags)) {
        post.tags.forEach(tag => tagSet.add(tag.toLowerCase()))
      }
    })
    return Array.from(tagSet).sort()
  }, [posts])

  const inflightRef = useRef<Set<string>>(new Set())
  const prefetchStartedRef = useRef(false)

  useEffect(() => {
    setPosts(initialPosts)
    prefetchStartedRef.current = false
  }, [initialPosts])

  // Update selected types if initialType changes (via route navigation)
  useEffect(() => {
    if (initialType) {
      const typeLabel = contentTypes.find(t => t.value.toLowerCase() === initialType.toLowerCase())?.value
      if (typeLabel) {
        setSelectedTypes([typeLabel])
      }
    } else {
      setSelectedTypes([])
    }
  }, [initialType])

  const filteredPosts = useMemo(() => {
    // Fuzzy match: checks if all characters of query appear in order in target
    const fuzzyMatch = (target: string, query: string): number => {
      if (!target || !query) return 0
      const t = target.toLowerCase()
      const q = query.toLowerCase()
      if (t.includes(q)) return 1.0 // exact substring = perfect
      // Check character-by-character fuzzy match
      let ti = 0, qi = 0, matched = 0
      while (ti < t.length && qi < q.length) {
        if (t[ti] === q[qi]) { matched++; qi++ }
        ti++
      }
      if (qi < q.length) return 0 // didn't match all query chars
      return matched / Math.max(t.length, q.length) * 0.7 // partial score
    }

    // Synonyms for type names (Norwegian ↔ English)
    const typeSynonyms: Record<string, string[]> = {
      skriving: ['writing', 'artikkel', 'article', 'essay', 'tekst', 'text'],
      bok: ['book', 'books', 'reading', 'lesing', 'review', 'bokmelding'],
      prosjekt: ['project', 'projects', 'work', 'arbeid'],
      lenkje: ['link', 'links', 'lenke', 'url', 'nettside', 'website'],
      interaktiv: ['interactive', 'app', 'demo', 'visualisering', 'visualization'],
      bilete: ['image', 'images', 'photo', 'photos', 'bilder', 'bilde', 'gallery', 'galleri'],
      presentasjon: ['slides', 'slide', 'presentation', 'deck', 'figma', 'lysbilete'],
    }

    const scorePost = (post: Post, query: string): number => {
      if (!query) return 1
      const q = query.toLowerCase().trim()
      const terms = q.split(/\s+/)
      let totalScore = 0

      for (const term of terms) {
        let best = 0

        // Title (highest weight)
        best = Math.max(best, fuzzyMatch(post.title, term) * 10)

        // Tags
        if (Array.isArray(post.tags)) {
          for (const tag of post.tags) {
            best = Math.max(best, fuzzyMatch(tag, term) * 7)
          }
        }

        // Type name + synonyms
        best = Math.max(best, fuzzyMatch(post.type, term) * 6)
        const syns = typeSynonyms[post.type.toLowerCase()] || []
        for (const syn of syns) {
          best = Math.max(best, fuzzyMatch(syn, term) * 5)
        }

        // Description
        best = Math.max(best, fuzzyMatch(post.description, term) * 4)

        // Slug
        best = Math.max(best, fuzzyMatch(post.slug, term) * 3)

        // Content (lower weight, just check inclusion for perf)
        if (post.content?.toLowerCase().includes(term)) {
          best = Math.max(best, 2)
        }

        // Date (year/month)
        if (post.date?.includes(term)) {
          best = Math.max(best, 3)
        }

        totalScore += best
      }

      return totalScore / terms.length
    }

    try {
      const scored = posts
        .map(post => {
          const matchesTypes = selectedTypes.length === 0 || selectedTypes.includes(post.type)
          const matchesTags = selectedTags.length === 0 ||
            (Array.isArray(post.tags) && post.tags.some(tag =>
              selectedTags.includes(tag.toLowerCase())
            ))
          if (!matchesTypes || !matchesTags) return null
          const score = scorePost(post, search)
          if (search && score < 1) return null
          return { post, score }
        })
        .filter((x): x is { post: Post; score: number } => x !== null)

      // If searching, sort by relevance; otherwise keep date order
      if (search) {
        scored.sort((a, b) => b.score - a.score)
      }

      return scored.map(x => x.post)
    } catch (err) {
      console.error('Error filtering posts:', err)
      return []
    }
  }, [posts, search, selectedTypes, selectedTags])

  // Fetch + serialize a single post's content and merge it into state. Guarded
  // so the same post is never fetched twice concurrently.
  const ensureSerialized = useCallback(async (id: string, uid: string) => {
    if (inflightRef.current.has(id)) return
    inflightRef.current.add(id)
    try {
      const res = await fetch(`/api/posts/${id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.source) {
          setPosts(prev => prev.map(p => (p.uid === uid ? { ...p, serialized: data.source, content: data.content ?? p.content } : p)))
        }
      }
    } catch (e) {
      console.error("Failed to fetch post content", e)
    } finally {
      inflightRef.current.delete(id)
    }
  }, [])

  // Prefetch every post's content in the background so expanding is instant and
  // never shows a spinner. Runs once per list, throttled to spare the Notion API.
  useEffect(() => {
    if (prefetchStartedRef.current || posts.length === 0) return
    prefetchStartedRef.current = true
    const pending = posts.filter(p => p.id && !p.serialized)
    if (pending.length === 0) return
    let cancelled = false
    let i = 0
    const worker = async () => {
      while (!cancelled && i < pending.length) {
        const p = pending[i++]
        await ensureSerialized(p.id!, p.uid)
      }
    }
    const t = setTimeout(() => {
      for (let w = 0; w < 3; w++) worker()
    }, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [posts, ensureSerialized])

  const handlePostToggle = (uid: string) => {
    setExpandedPosts(prev => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
    const post = posts.find(p => p.uid === uid)
    if (post && !post.serialized && post.id) ensureSerialized(post.id, post.uid)
  }

  return (
    <div
      className={cn(
        'max-w-full overflow-x-hidden',
        // Skissebok fills exactly one screen with no page scroll. Stay inside the
        // page's padded container (so the header spacing matches the other tabs)
        // and subtract that container's py-8 (4rem) from 100svh.
        view === 'skissebok'
          ? 'flex h-[calc(100svh-4rem)] flex-col overflow-hidden'
          : view === '404'
            // The game fills the whole viewport (header included) regardless of
            // the page's max-width/padding wrapper — fixed breaks out of it.
            ? 'fixed inset-0 z-40 flex flex-col overflow-hidden bg-background'
            : 'min-h-screen'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-2 sm:px-4 pt-4',
          // The fixed 404 view escapes the page's `max-w-6xl mx-auto px-2 py-8
          // sm:px-4` wrapper, so fold that wrapper's geometry into the header
          // here — the navbar must sit in the exact same spot on every tab.
          view === '404' && 'mx-auto w-full max-w-6xl px-4 pt-12 sm:px-8'
        )}
      >
        <Link
          href="/"
          aria-label="iverfinne.no"
          className="flex items-center"
          onClick={(e) => {
            // Modified clicks (new tab etc.) keep normal link behaviour.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
            // Already on the home route: the tabs are client state and a
            // same-URL navigation is a no-op, so switch the tab directly.
            if (window.location.pathname === '/') {
              e.preventDefault()
              setView('timeline')
            }
            // Any other route (mistyped URL, /404-blokk, …): let the Link
            // navigate to '/', which mounts fresh on the timeline view.
          }}
        >
          <img src={view === 'skissebok' ? '/icon-white.png' : '/icon.svg'} alt="" width={28} height={28} className="h-7 w-7" />
        </Link>
        <div className="flex items-center gap-3">
        <a
          href="https://github.com/lukketsvane"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className={cn(
            'transition-colors',
            view === 'skissebok'
              ? 'text-gray-300 hover:text-white'
              : 'text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-100'
          )}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="h-6 w-6">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
        </a>
        <div
          className={cn(
            'inline-flex items-center rounded-full p-1 text-sm font-medium transition-colors',
            view === 'skissebok' ? 'bg-white/10' : 'bg-gray-100 dark:bg-gray-800'
          )}
        >
          {([
            ['timeline', 'Tidslinje', 'bg-blue-600'],
            ['gallery', 'Galleri', 'bg-orange-500'],
            ['om', 'Om meg', 'bg-green-600'],
            // Skissebok is hidden for now — restore the tuple below to bring the tab back.
            // ['skissebok', 'Skissebok', 'bg-red-500'],
            // The "404" tab only appears once the visitor has discovered it.
            // Its colour follows the active game (retapping it toggles games).
            ...(found404 ? [['404', '404', GAMES[game ?? 'blokk'].tabColor]] : []),
          ] as [string, string, string][]).map(([v, label, activeColor]) => (
            <button
              key={v}
              onClick={() => {
                // Retapping the already-active 404 tab flips to the other game
                // and recolours the pill. Deliberately no URL update: the app
                // router treats history.replaceState as a navigation, and
                // template.tsx remounts (resetting this state) on navigation.
                if (v === '404' && view === '404') {
                  setGame(game === 'kloss' ? 'blokk' : 'kloss')
                  return
                }
                setView(v as typeof view)
              }}
              aria-pressed={view === v}
              className={cn(
                "relative px-3 py-1.5 rounded-full transition-colors",
                view === v
                  ? "text-white"
                  : view === 'skissebok'
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              )}
            >
              {/* Shared-layout pill: slides (and recolours) between tabs. */}
              {view === v && (
                <motion.span
                  layoutId="view-tab-pill"
                  aria-hidden
                  className={cn('absolute inset-0 rounded-full shadow-sm', activeColor)}
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        </div>
      </div>
    <div className={cn('max-w-full overflow-x-hidden', view === 'skissebok' || view === '404' ? 'flex min-h-0 flex-1 flex-col' : 'px-2 py-4 sm:p-4')}>
      <main className={cn('min-w-0', (view === 'skissebok' || view === '404') && 'flex min-h-0 flex-1 flex-col')}>
        {/* Gentle fade-in when switching tabs. Deliberately no AnimatePresence:
            the views unmount inner motion components at will (year collapse,
            card expansion), which corrupts presence exit bookkeeping. A keyed
            fade-in-only div gets the smoothness without that hazard. */}
        <motion.div
          key={view}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={view === 'skissebok' || view === '404' ? 'flex min-h-0 flex-1 flex-col' : 'space-y-4'}
        >
        {/* Search + category filters only apply to the timeline; the gallery and
            sketchbook tabs show everything, so hide them there. */}
        {view === 'timeline' && (
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <Input
                placeholder="Leit i arkivet…"
                className="pl-10 pr-10 py-2 text-base sm:text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300 dark:focus-visible:border-gray-600"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                aria-label="Vis/skjul filter"
                aria-expanded={filtersOpen}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', filtersOpen && 'rotate-180')} />
              </button>
            </div>
            {/* Always mounted so open/close is a smooth height animation instead of
                a pop-in; `inert` keeps the hidden pills out of tab order. The pt-4
                lives inside the measured content, so it collapses along with it. */}
            <motion.div
              initial={false}
              animate={{ height: filtersOpen ? 'auto' : 0, opacity: filtersOpen ? 1 : 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
              inert={!filtersOpen}
            >
              {/* Empty selection means "all" — so every pill reads as selected by default. */}
              <div className="flex flex-wrap gap-1.5 pt-4">
                {contentTypes.map((type) => (
                  <FilterButton
                    key={type.value}
                    label={type.label}
                    isActive={selectedTypes.length === 0 || selectedTypes.includes(type.value)}
                    onClick={() => {
                      setSelectedTypes((prev) => {
                        // From "all" (empty), the first click isolates to just this type.
                        if (prev.length === 0) return [type.value]
                        // Otherwise toggle it; deselecting the last one returns to "all".
                        return prev.includes(type.value)
                          ? prev.filter((t) => t !== type.value)
                          : [...prev, type.value]
                      })
                    }}
                    variant="type"
                  />
                ))}
              </div>
            </motion.div>
          </div>
        )}
        {view === 'gallery' ? (
          // Pull out to the container edge on mobile (the -mx exactly cancels the
          // p-4 wrapper, so an ancestor's overflow-x-hidden never clips the
          // frames). Normal containment from sm: up. The gallery deliberately
          // shows every post — the timeline's search/filters don't apply here.
          <div className="mt-4 -mx-2 sm:mx-0">
            <GalleryView posts={posts} />
          </div>
        ) : view === 'skissebok' ? (
          <Skissebok />
        ) : view === 'om' ? (
          <OmMeg />
        ) : view === '404' ? (
          // Edge-to-edge under the header — no borders, no page padding; the
          // fixed root (see container above) provides the viewport-sized frame.
          <div className="relative mt-4 min-h-0 flex-1">
            {game && (
              <iframe
                key={game}
                src={GAMES[game].url}
                title={GAMES[game].name}
                allow="fullscreen"
                className="absolute inset-0 h-full w-full border-0"
              />
            )}
          </div>
        ) : (
        <motion.div
          className="relative mt-4"
          layout
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {filteredPosts.length > 0 ? (
            filteredPosts.map((post, index) => {
              const currentYear = new Date(post.date).getFullYear()
              const prevYear = index > 0 ? new Date(filteredPosts[index - 1].date).getFullYear() : null
              const showYear = currentYear !== prevYear
              const yearCollapsed = collapsedYears.has(currentYear)

              return (
                <div key={post.uid}>
                  {showYear && (
                    <div className="relative grid grid-cols-[auto,1fr] gap-3 sm:gap-4 max-w-full">
                      <div className="w-14 sm:w-20 shrink-0" />
                      <div className="relative">
                        {/* The very first year pill is where the line begins: start it
                            behind the pill (top-1/2) instead of poking a floating stub
                            up into the search/filter area. Later year rows bridge the
                            gap up to the previous card with -top-4. */}
                        <div className={cn(
                          "absolute -left-1.5 sm:-left-2 w-0.5 bottom-0 bg-gray-200 dark:bg-gray-700 -translate-x-1/2",
                          index === 0 ? "top-1/2" : "-top-4"
                        )} />
                        <div className="py-4">
                          {/* Tapping the year pill collapses/expands every post from that year. */}
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedYears(prev => {
                                const next = new Set(prev)
                                if (next.has(currentYear)) next.delete(currentYear)
                                else next.add(currentYear)
                                return next
                              })
                            }
                            aria-expanded={!yearCollapsed}
                            aria-label={`${yearCollapsed ? 'Vis' : 'Skjul'} innlegg frå ${currentYear}`}
                            className="bg-white dark:bg-gray-900 pl-3 pr-1.5 py-1 text-sm font-bold text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full relative z-10 -translate-x-[calc(50%+6px)] sm:-translate-x-[calc(50%+8px)] inline-flex items-center gap-0.5 transition-colors hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                          >
                            {currentYear}
                            <ChevronDown className={cn('h-3 w-3 transition-transform', yearCollapsed && '-rotate-90')} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {!yearCollapsed && (
                    <MDXCard
                      post={post}
                      isExpanded={expandedPosts.has(post.uid)}
                      onToggle={() => handlePostToggle(post.uid)}
                      serializedContent={post.serialized || null}
                    />
                  )}
                </div>
              )
            })
          ) : error ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Feil ved lasting av innlegg</p>
          ) : posts.length > 0 ? (
            // Posts exist but none survive the search/filters — say so instead
            // of showing a silently blank page.
            <div className="px-2 py-16 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ingen treff{search ? <> for «{search}»</> : null}.
              </p>
              <button
                type="button"
                onClick={() => { setSearch(''); setSelectedTypes([]); setSelectedTags([]) }}
                className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200 underline underline-offset-4 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Nullstill søk og filter
              </button>
            </div>
          ) : null}
        </motion.div>
        )}
        </motion.div>
      </main>
    </div>
    </div>
  )
}
