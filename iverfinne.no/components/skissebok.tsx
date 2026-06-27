'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Two placeholder drawings, repeated ~20 times until the real sketchbook lands.
const DRAWINGS = ['/skissebok/teikning-1.png', '/skissebok/teikning-2.png']
const PAGES = Array.from({ length: 20 }, (_, i) => DRAWINGS[i % DRAWINGS.length])

// Moleskine Large: single page 13×21 cm, open spread 26×21 cm.
const PAGE_AR = '13 / 21'
const SPREAD_AR = '26 / 21'
const PAPER = 'bg-[#f6f2e7] dark:bg-[#ece6d6]'

// ── 3D flip book ──────────────────────────────────────────────────────────
function FlipBook() {
  const leaves: { front: string; back: string }[] = []
  for (let i = 0; i < PAGES.length; i += 2) {
    leaves.push({ front: PAGES[i], back: PAGES[i + 1] ?? PAGES[i] })
  }
  const [turned, setTurned] = useState(0)

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="w-full max-w-3xl" style={{ perspective: '2400px' }}>
        <div
          className={cn('relative mx-auto w-full rounded-md shadow-2xl', PAPER)}
          style={{ aspectRatio: SPREAD_AR, transformStyle: 'preserve-3d' }}
        >
          {/* Spine shadow down the centre */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-50 w-8 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
          {leaves.map((leaf, i) => {
            const isTurned = turned > i
            return (
              <div
                key={i}
                onClick={() => setTurned(isTurned ? i : i + 1)}
                className="absolute right-0 top-0 h-full w-1/2 cursor-pointer"
                style={{
                  transformOrigin: 'left center',
                  transformStyle: 'preserve-3d',
                  transform: `rotateY(${isTurned ? -180 : 0}deg)`,
                  transition: 'transform 0.8s cubic-bezier(0.645, 0.045, 0.355, 1)',
                  zIndex: isTurned ? i : leaves.length - i,
                }}
              >
                <div
                  className={cn('absolute inset-0 overflow-hidden border-l border-black/10', PAPER)}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <img src={leaf.front} alt="" className="h-full w-full object-cover" draggable={false} />
                </div>
                <div
                  className={cn('absolute inset-0 overflow-hidden border-r border-black/10', PAPER)}
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <img src={leaf.back} alt="" className="h-full w-full object-cover" draggable={false} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setTurned((t) => Math.max(0, t - 1))}
          disabled={turned === 0}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 disabled:opacity-30"
          aria-label="Førre"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm tabular-nums text-muted-foreground">{turned} / {leaves.length}</span>
        <button
          onClick={() => setTurned((t) => Math.min(leaves.length, t + 1))}
          disabled={turned === leaves.length}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 disabled:opacity-30"
          aria-label="Neste"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

// ── Loose-sheet stack: drag the top sheet away to cycle ─────────────────────
function SheetStack() {
  const [deck, setDeck] = useState(() => PAGES.map((_, i) => i))
  const top = deck.slice(0, 3)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-[280px]" style={{ aspectRatio: PAGE_AR }}>
        {top
          .map((p, pos) => ({ p, pos }))
          .reverse()
          .map(({ p, pos }) => {
            const isTop = pos === 0
            return (
              <motion.div
                key={p}
                className={cn('absolute inset-0 overflow-hidden rounded-lg shadow-xl', PAPER, isTop ? 'cursor-grab active:cursor-grabbing' : '')}
                style={{ zIndex: top.length - pos }}
                animate={{ scale: 1 - pos * 0.05, y: pos * 14, rotate: isTop ? 0 : (pos % 2 ? 1.5 : -1.5) }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                drag={isTop}
                dragSnapToOrigin
                onDragEnd={(_, info) => {
                  if (Math.abs(info.offset.x) > 90 || Math.abs(info.offset.y) > 90) {
                    setDeck((d) => [...d.slice(1), d[0]])
                  }
                }}
              >
                <img src={PAGES[p]} alt="" className="pointer-events-none h-full w-full object-cover" draggable={false} />
              </motion.div>
            )
          })}
      </div>
      <p className="text-sm text-muted-foreground">Dra arket til sides for å bla.</p>
    </div>
  )
}

export default function Skissebok() {
  const [mode, setMode] = useState<'bok' | 'ark'>('bok')

  return (
    <div className="mt-6 flex flex-col items-center gap-6">
      <div className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 p-1 text-sm font-medium">
        {([['bok', 'Bok'], ['ark', 'Laus ark']] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'rounded-full px-4 py-1.5 transition-colors',
              mode === m
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'bok' ? <FlipBook /> : <SheetStack />}

      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Plassholdar-teikningar — ein digital tvilling av den fysiske skisseboka kjem.
      </p>
    </div>
  )
}
