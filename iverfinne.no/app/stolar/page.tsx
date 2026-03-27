import type { Metadata } from 'next'
import StolarResearch from '@/components/stolar-research'

export const metadata: Metadata = {
  title: 'STOLAR Forsking',
  description:
    'AI-driven formforsking på 2 048 stolar, grunnlagd i FORMLÆRE-rammeverket.',
}

export default function StolarPage() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          STOLAR Forsking
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          AI-driven analyse av 2 048 stolar frå Nasjonalmuseet og V&amp;A,
          grunnlagd i{' '}
          <span className="font-semibold">FORMLÆRE</span>-rammeverket.
        </p>
      </header>
      <StolarResearch />
    </div>
  )
}
