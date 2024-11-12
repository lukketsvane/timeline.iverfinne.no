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
        <h1 className="text-4xl font-bold text-center mb-2">build-in-public log</h1>
        <p className="text-xl text-muted-foreground text-center mb-12">
          some of my tools and experiments.
        </p>
        <FeaturedBuilds />
      </div>
      <ProjectsTimeline />
    </main>
  )
}