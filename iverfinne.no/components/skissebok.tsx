'use client'

import { useState } from 'react'
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

// Moleskine Large: open spread 26×21 cm.
const SPREAD_AR = '26 / 21'
const PAPER = 'bg-[#f6f2e7] dark:bg-[#ece6d6]'
const FLIP = 'transform 0.8s cubic-bezier(0.645, 0.045, 0.355, 1)'

// 20260627 → "27.06.2026"
function formatDate(date: string) {
  return `${date.slice(6, 8)}.${date.slice(4, 6)}.${date.slice(0, 4)}`
}

// One 13×21 leaf face. A `spread` drawing is split across two faces, each
// showing its own half so the whole image reappears when the spread is open.
type Face =
  | { kind: 'page'; drawing: Drawing; half?: 'left' | 'right' }
  | { kind: 'cover'; side: 'front' | 'back' }
  | { kind: 'blank' } // endpaper / padding

// The black Moleskine board — front cover carries the elastic closure.
function Cover({ side }: { side: 'front' | 'back' }) {
  const round = side === 'front' ? 'rounded-l-[3px] rounded-r-[16px]' : 'rounded-r-[3px] rounded-l-[16px]'
  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-gradient-to-br from-[#232323] via-[#141414] to-[#070707] shadow-2xl', round)}>
      {/* leatherette sheen */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_72%_18%,rgba(255,255,255,0.07),transparent_60%)]" />
      {/* board bevel */}
      <div className={cn('pointer-events-none absolute inset-[3px] ring-1 ring-inset ring-white/5', round)} />
      {/* elastic closure band near the fore-edge */}
      {side === 'front' && (
        <div className="absolute right-[8%] top-0 h-full w-[7px] bg-gradient-to-r from-black/50 via-[#303030] to-black/50 shadow-[0_0_5px_rgba(0,0,0,0.7)]" />
      )}
    </div>
  )
}

function FaceContent({ face }: { face: Face }) {
  if (face.kind === 'cover') return <Cover side={face.side} />
  if (face.kind === 'blank') return <div className={cn('h-full w-full', PAPER)} />
  return (
    <img
      src={face.drawing.src}
      alt=""
      draggable={false}
      className="h-full w-full object-cover"
      style={face.half ? { objectPosition: face.half === 'left' ? 'left center' : 'right center' } : undefined}
    />
  )
}

// Lay drawings into single-page faces. Spreads must straddle an open spread,
// i.e. occupy a (left page, right page) pair, so pad to an odd index first.
function buildDrawingFaces(drawings: Drawing[]): Face[] {
  const faces: Face[] = []
  for (const d of drawings) {
    if (d.format === 'spread') {
      if (faces.length % 2 === 0) faces.push({ kind: 'blank' })
      faces.push({ kind: 'page', drawing: d, half: 'left' }, { kind: 'page', drawing: d, half: 'right' })
    } else {
      faces.push({ kind: 'page', drawing: d })
    }
  }
  if (faces.length % 2 !== 0) faces.push({ kind: 'blank' })
  return faces
}

const faceDate = (f?: Face): string | null => (f && f.kind === 'page' ? f.drawing.date : null)

// ── 3D flip book ──────────────────────────────────────────────────────────
function FlipBook() {
  // Wrap the drawing pages between hard covers + endpapers so the book opens
  // from the closed front cover and closes onto the back cover.
  const faces: Face[] = [
    { kind: 'cover', side: 'front' },
    { kind: 'blank' },
    ...buildDrawingFaces(DRAWINGS),
    { kind: 'blank' },
    { kind: 'cover', side: 'back' },
  ]
  const leaves: { front: Face; back: Face }[] = []
  for (let i = 0; i < faces.length; i += 2) {
    leaves.push({ front: faces[i], back: faces[i + 1] })
  }

  const [turned, setTurned] = useState(0)
  const atStart = turned === 0
  const atEnd = turned === leaves.length

  // Slide the closed book to centre its single visible cover; centre the spread once open.
  const shift = atStart ? '-25%' : atEnd ? '25%' : '0%'
  const currentDate = atStart || atEnd ? null : faceDate(faces[2 * turned]) ?? faceDate(faces[2 * turned - 1])

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        className="mx-auto w-full max-w-3xl"
        style={{ perspective: '2400px', transform: `translateX(${shift})`, transition: FLIP }}
      >
        <div className="relative w-full" style={{ aspectRatio: SPREAD_AR, transformStyle: 'preserve-3d' }}>
          {/* Hard back board — frames the cream pages once the book is open */}
          <div
            className="absolute -inset-x-[1.4%] -inset-y-[2.2%] rounded-[14px] bg-gradient-to-br from-[#1f1f1f] via-[#141414] to-[#070707] shadow-2xl transition-opacity duration-500"
            style={{ opacity: atStart || atEnd ? 0 : 1 }}
          />
          {/* Soft gutter shading either side of the spine — a gentle fold, not a hard groove */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-40 h-full w-1/2 -translate-x-full bg-gradient-to-l from-black/12 to-transparent to-30%" />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-40 h-full w-1/2 bg-gradient-to-r from-black/12 to-transparent to-30%" />

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
                  transition: FLIP,
                  zIndex: isTurned ? i : leaves.length - i,
                }}
              >
                <div className="absolute inset-0 overflow-hidden" style={{ backfaceVisibility: 'hidden' }}>
                  <FaceContent face={leaf.front} />
                </div>
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <FaceContent face={leaf.back} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mx-auto h-5 w-full max-w-3xl">
        {currentDate && <span className="text-sm tabular-nums text-muted-foreground">{formatDate(currentDate)}</span>}
      </div>
    </div>
  )
}

export default function Skissebok() {
  return (
    <div className="mt-6 flex flex-col items-center gap-6">
      <FlipBook />
    </div>
  )
}
