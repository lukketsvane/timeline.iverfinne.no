'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCw } from 'lucide-react'

// Notion can always rate-limit a cold render. When it does, the reader should
// get an explanation and a retry button in the site's own voice, not Next's
// bare "Application error: a server-side exception has occurred" — reset()
// re-renders the route, which succeeds as soon as the cooldown has passed.
export default function PostError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Post page render failed:', error)
  }, [error])

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 min-h-screen">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Tilbake til forsida
      </Link>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
        Innlegget kunne ikkje hentast
      </h1>
      <p className="text-muted-foreground font-serif text-lg max-w-prose">
        Teksten ligg i Notion, og henting derifrå feila akkurat no. Det går
        vanlegvis over av seg sjølv i løpet av eit minutt.
      </p>

      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm hover:bg-muted transition-colors"
      >
        <RotateCw className="w-4 h-4" />
        Prøv igjen
      </button>

      {error.digest && (
        <p className="mt-8 text-xs text-muted-foreground font-mono">
          Feilkode: {error.digest}
        </p>
      )}
    </div>
  )
}
