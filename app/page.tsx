import ProjectsTimeline from '../components/projects-timeline'

export const metadata = {
  title: 'Projects Timeline',
  description: 'A timeline of my projects and writings',
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <ProjectsTimeline />
    </main>
  )
}