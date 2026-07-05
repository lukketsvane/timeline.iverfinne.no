export const revalidate = 60
// Cold-cache regenerations fan out per-post Notion calls + dimension probes;
// give them room beyond the 10s default so ISR never times out.
export const maxDuration = 60

import HomePage from '@/components/home-page'
import { getPublishedPosts } from '@/lib/notion'
import { generateWebsiteJsonLd, generatePersonJsonLd } from '@/lib/structured-data'

export default async function Home() {
  const posts = await getPublishedPosts()

  const websiteJsonLd = generateWebsiteJsonLd()
  const personJsonLd = generatePersonJsonLd()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([websiteJsonLd, personJsonLd]) }}
      />
      <div className="w-full max-w-6xl mx-auto px-2 py-8 sm:px-4 overflow-x-hidden">
        <HomePage initialPosts={JSON.parse(JSON.stringify(posts))} />
      </div>
    </>
  )
}
