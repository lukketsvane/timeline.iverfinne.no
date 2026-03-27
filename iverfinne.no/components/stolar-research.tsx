'use client'

import { useState, useRef } from 'react'
import { FORMLAERE_PROPOSITIONS } from '@/lib/formlaere'

const EXAMPLE_QUERIES = [
  'Korleis endrar materialvalet seg frå barokk til funksjonalisme, og kva seier det om seleksjonstrykka (2.19)?',
  'Vis formvariasjon under konstant funksjon (2.22): kor stor er spreiinga i dimensjonar for alle 2048 stolar?',
  'Analyser materialets geometriske signatur (5.2): korleis påverkar tre vs. stål stolens proporsjonar?',
  'Kva stilperiodar representerer haugar i tilpassingslandskapet (3.22), og kva skjedde ved overgangane?',
  'Korleis illustrerer mahogni si historie (5.4) den geopolitiske dimensjonen av stoldesign?',
]

export default function StolarResearch() {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  async function runResearch() {
    if (!query.trim()) return

    setLoading(true)
    setResponse('')
    setError('')

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error || `Feil: ${res.status}`)
        setLoading(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setError('Kunne ikkje lese svaret')
        setLoading(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                setResponse((prev) => prev + parsed.text)
              }
            } catch {
              // skip
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('Nettverksfeil: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  function stopResearch() {
    abortRef.current?.abort()
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* FORMLÆRE propositions */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <h2 className="font-semibold text-sm mb-2 uppercase tracking-wide">
          Formlære: Proposisjonar
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
          {FORMLAERE_PROPOSITIONS.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                setQuery(
                  `Analyser databasen i lys av proposisjon ${p.id}: "${p.title}". Gjev kvantitative døme.`
                )
              }
              className="text-left p-1.5 rounded hover:bg-muted transition-colors"
            >
              <span className="font-mono font-bold">{p.id}</span>{' '}
              <span className="text-muted-foreground">{p.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Query input */}
      <div className="space-y-2">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Skriv eit forskingsspørsmål om stolar, form, material, eller stilperiodar..."
          className="w-full min-h-[100px] p-3 border rounded-lg bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              runResearch()
            }
          }}
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {loading ? (
              <button
                onClick={stopResearch}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90"
              >
                Stopp
              </button>
            ) : (
              <button
                onClick={runResearch}
                disabled={!query.trim()}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                Køyr forsking
              </button>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {query.length}/2000 · ⌘+Enter for å køyre
          </span>
        </div>
      </div>

      {/* Example queries */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Døme på spørsmål
        </p>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_QUERIES.map((eq, i) => (
            <button
              key={i}
              onClick={() => setQuery(eq)}
              className="text-xs px-2 py-1 rounded-full border hover:bg-muted transition-colors text-left"
            >
              {eq.length > 80 ? eq.slice(0, 77) + '...' : eq}
            </button>
          ))}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Response */}
      {(response || loading) && (
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Forskingsresultat</h3>
            {loading && (
              <span className="text-xs text-muted-foreground animate-pulse">
                Analyserer...
              </span>
            )}
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-sm leading-relaxed">
            {response || (
              <span className="text-muted-foreground animate-pulse">
                Ventar på svar...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
