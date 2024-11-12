import { notFound } from 'next/navigation'
import ProjectsTimeline from '@/components/projects-timeline'
import { fetchProjects, fetchWritings, fetchBooks, fetchOutgoingLinks, ContentItem } from '@/lib/github'

export async function generateStaticParams() {
  const slugs = await fetchAllSlugs()
  return slugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const allEntries = await fetchAllEntries()
  const entry = allEntries.find(e => e.slug === params.slug)
  
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
  const allEntries = await fetchAllEntries()
  const entry = allEntries.find(e => e.slug === params.slug)

  if (!entry) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background">
      <ProjectsTimeline initialSlug={params.slug} />
    </main>
  )
}

async function fetchAllEntries(): Promise<ContentItem[]> {
  const [projects, writings, books, outgoingLinks] = await Promise.all([
    fetchProjects(),
    fetchWritings(),
    fetchBooks(),
    fetchOutgoingLinks()
  ])
  return [...projects, ...writings, ...books, ...outgoingLinks]
}

async function fetchAllSlugs() {
  const allEntries = await fetchAllEntries();
  return allEntries.map(entry => entry.slug);
}

type Metadata = {
  title: string;
  description: string;
};