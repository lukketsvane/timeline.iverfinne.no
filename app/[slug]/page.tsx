import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import ProjectsTimeline from '@/components/projects-timeline'
import { fetchProjects, fetchWriting, fetchBooks, Outgoing, ContentItem, fetchAllEntries, fetchAllSlugs, fetchEntryBySlug } from '@/lib/github'

export async function generateStaticParams() {
  const slugs = await fetchAllSlugs()
  return slugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const entry = await fetchEntryBySlug(params.slug)
  
  if (!entry) {
    return {
      title: 'Not Found',
      description: 'The page you\'re looking for doesn\'t exist.',
    }
  }

  return {
    title: `${entry.title} | Iver's Timeline`,
    description: entry.description,
  }
}

export default async function EntryPage({ params }: { params: { slug: string } }) {
  const entry = await fetchEntryBySlug(params.slug)

  if (!entry) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background">
      <ProjectsTimeline initialSlug={params.slug} />
    </main>
  )
}