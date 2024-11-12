import { Metadata } from 'next'
import ProjectsTimeline from '@/components/projects-timeline'
import { fetchProjects, Project } from '@/lib/github'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const projects = await fetchProjects()
  const project = projects.find(p => p.slug === params.slug)
  
  if (!project) {
    return { title: 'Project Not Found' }
  }

  return {
    title: `${project.title} | Projects Timeline`,
    description: project.description,
  }
}

export default async function ProjectPage({ params }: { params: { slug: string } }) {
  const projects = await fetchProjects()
  const project = projects.find((p): p is Project => p.slug === params.slug)

  if (!project) {
    return <div>Project not found</div>
  }

  return <ProjectsTimeline initialSlug={params.slug} />
}