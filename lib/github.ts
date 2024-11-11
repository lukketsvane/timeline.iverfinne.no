import ProjectsTimeline from '@/components/projects-timeline'

export const metadata = {
  title: 'Projects Timeline',
  description: 'A timeline of projects and writings from my personal web',
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <ProjectsTimeline />
    </main>
  )
}