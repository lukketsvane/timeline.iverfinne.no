'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

// Digital sketchbook. Each drawing is named skb_YYYYMMDD_FORMAT_NR.png where
// FORMAT is `page` (single 13×21 leaf) or `spread` (full 26×21 open spread).
type Format = 'page' | 'spread'
type Drawing = { date: string; format: Format; nr: number; src: string }

const file = (date: string, format: Format, nr: number): Drawing => ({
  date,
  format,
  nr,
  src: `/skissebok/skb_${date}_${format}_${String(nr).padStart(2, '0')}.png`,
})

// Newest first — sorted by date, then number.
const DRAWINGS: Drawing[] = [
  file('20260627', 'page', 1),
  file('20241028', 'page', 2),
  file('20241020', 'spread', 1),
  file('20241020', 'page', 3),
]

// Moleskine Large: single page 13×21 cm, open spread 26×21 cm.
const PAGE_AR = '13 / 21'
const SPREAD_AR = '26 / 21'
const PAPER = 'bg-[#f6f2e7] dark:bg-[#ece6d6]'

// 20260627 → "27.06.2026"
function formatDate(date: string) {
  return `${date.slice(6, 8)}.${date.slice(4, 6)}.${date.slice(0, 4)}`
}

// A single 13×21 leaf face. A `spread` drawing is split across two faces, each
// showing its own half so the whole image reappears when the spread is open.
type Face = { drawing: Drawing; half?: 'left' | 'right' } | null

function FaceImg({ face }: { face: Face }) {
  if (!face) return null
  const { drawing, half } = face
  return (
    <img
      src={drawing.src}
      alt=""
      draggable={false}
      className="h-full w-full object-cover"
      style={half ? { objectPosition: half === 'left' ? 'left center' : 'right center' } : undefined}
    />
  )
}

// Lay drawings into single-page faces. Spreads must straddle an open spread,
// i.e. occupy a (left page, right page) pair, so pad to an odd face index first.
function buildFaces(drawings: Drawing[]): Face[] {
  const faces: Face[] = []
  for (const d of drawings) {
    if (d.format === 'spread') {
      if (faces.length % 2 === 0) faces.push(null) // pad so the left half lands on a left page
      faces.push({ drawing: d, half: 'left' }, { drawing: d, half: 'right' })
    } else {
      faces.push({ drawing: d })
    }
  }
  if (faces.length % 2 !== 0) faces.push(null)
  return faces
}

// ── 3D flip book ──────────────────────────────────────────────────────────
function FlipBook() {
  const faces = buildFaces(DRAWINGS)
  const leaves: { front: Face; back: Face }[] = []
  for (let i = 0; i < faces.length; i += 2) {
    leaves.push({ front: faces[i], back: faces[i + 1] })
  }
  const [turned, setTurned] = useState(0)

  // The right-hand page currently being read, used for the date caption.
  const current = faces[2 * turned]?.drawing ?? faces[2 * turned - 1]?.drawing ?? DRAWINGS[0]

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="w-full max-w-3xl" style={{ perspective: '2400px' }}>
        {/* Moleskine hard cover: a black board peeking around the cream pages */}
        <div className="relative mx-auto w-full" style={{ aspectRatio: SPREAD_AR }}>
          <div className="absolute -inset-x-[1.4%] -inset-y-[2.2%] rounded-l-[6px] rounded-r-[16px] bg-gradient-to-br from-[#1f1f1f] via-[#141414] to-[#070707] shadow-2xl" />
          {/* Fore-edge elastic band */}
          <div className="absolute -right-[1.4%] top-0 z-[60] h-full w-[7px] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#060606] via-[#2a2a2a] to-[#060606]" />

          <div
            className={cn('absolute inset-0 rounded-sm', PAPER)}
            style={{ aspectRatio: SPREAD_AR, transformStyle: 'preserve-3d' }}
          >
          {/* Soft gutter shading either side of the spine — a gentle fold, not a hard groove */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-50 h-full w-1/2 -translate-x-full bg-gradient-to-l from-black/12 to-transparent to-30%" />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-50 h-full w-1/2 bg-gradient-to-r from-black/12 to-transparent to-30%" />
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
                  <FaceImg face={leaf.front} />
                </div>
                <div
                  className={cn('absolute inset-0 overflow-hidden border-r border-black/10', PAPER)}
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <FaceImg face={leaf.back} />
                </div>
              </div>
            )
          })}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <span className="text-sm tabular-nums text-muted-foreground">{formatDate(current.date)}</span>
      </div>
    </div>
  )
}

// ── Loose-sheet stack: drag the top sheet away to cycle ─────────────────────
function SheetStack() {
  const [deck, setDeck] = useState(() => DRAWINGS.map((_, i) => i))
  const top = deck.slice(0, 3)
  const current = DRAWINGS[deck[0]]

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-[280px]" style={{ aspectRatio: PAGE_AR }}>
        {top
          .map((p, pos) => ({ p, pos }))
          .reverse()
          .map(({ p, pos }) => {
            const isTop = pos === 0
            const d = DRAWINGS[p]
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
                    setDeck((deck) => [...deck.slice(1), deck[0]])
                  }
                }}
              >
                <img
                  src={d.src}
                  alt=""
                  draggable={false}
                  className="pointer-events-none h-full w-full object-cover"
                />
              </motion.div>
            )
          })}
      </div>
      <div className="w-full max-w-[280px]">
        <span className="text-sm tabular-nums text-muted-foreground">{formatDate(current.date)}</span>
      </div>
    </div>
  )
}

export default function Skissebok() {
  const [mode, setMode] = useState<'bok' | 'ark'>('bok')

  return (
    <div className="mt-6 flex flex-col items-center gap-6">
      <div className="flex items-center gap-5">
        {([['bok', BookOpen, 'Bok'], ['ark', Layers, 'Laus ark']] as const).map(([m, Icon, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-label={label}
            aria-pressed={mode === m}
            className={cn(
              'transition-colors',
              mode === m
                ? 'text-foreground'
                : 'text-muted-foreground/40 hover:text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={mode === m ? 2.25 : 1.75} />
          </button>
        ))}
      </div>

      {mode === 'bok' ? <FlipBook /> : <SheetStack />}
    </div>
  )
}
