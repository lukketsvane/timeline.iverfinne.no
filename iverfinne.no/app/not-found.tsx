'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// The two standalone games hosted on their own subdomains. One is picked at
// random on the client so the choice isn't baked in at build time (the 404
// page is statically prerendered).
const GAMES = [
  { name: 'bl.okk', url: 'https://blokk.iverfinne.no' },
  { name: 'kl.oss', url: 'https://kloss.iverfinne.no' },
] as const

export default function NotFound() {
  const [game, setGame] = useState<(typeof GAMES)[number] | null>(null)

  useEffect(() => {
    setGame(GAMES[Math.floor(Math.random() * GAMES.length)])
  }, [])

  return (
    <div className="fixed inset-0 bg-white">
      {game && (
        <iframe
          src={game.url}
          title={game.name}
          allow="fullscreen"
          className="h-full w-full border-0"
        />
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <span className="pointer-events-auto select-none rounded-full bg-white/80 px-3 py-1.5 font-mono text-xs text-neutral-500 shadow-sm backdrop-blur">
          404 — sida finst ikkje{game && <> · spel <em className="not-italic font-semibold text-neutral-700">{game.name}</em> så lenge</>}
        </span>
        <Link
          href="/"
          className="pointer-events-auto rounded-full bg-white/80 px-3 py-1.5 font-mono text-xs text-neutral-500 shadow-sm backdrop-blur transition-colors hover:text-neutral-900"
        >
          ← heim
        </Link>
      </div>
    </div>
  )
}
