import ProjectsTimeline from '@/components/projects-timeline'
import FeaturedBuilds from '@/components/featured-builds'

export const metadata = {
  title: "Iver's Timeline",
  description: 'A timeline of projects, writings, books, and external links',
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">

        <FeaturedBuilds />
      </div>
      <ProjectsTimeline />
    </main>
  )
}