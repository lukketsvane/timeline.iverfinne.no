import { notFound } from 'next/navigation'
import { fetchProjects } from "@/lib/github"
import ReactMarkdown from 'react-markdown'
import { Badge } from "@/components/ui/badge"

export default async function ProjectPage({ params }: { params: { slug: string } }) {
  const projects = await fetchProjects()
  const project = projects.find(p => p.slug === params.slug)

  if (!project) {
    notFound()
  }

  return (
    <article className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">{project.title}</h1>
      <p className="text-xl text-muted-foreground mb-4">{project.description}</p>
      <div className="flex flex-wrap gap-2 mb-8">
        {project.tags.map((tag, index) => (
          <Badge key={index} variant="secondary">{tag}</Badge>
        ))}
      </div>
      <div className="prose prose-lg dark:prose-invert">
        <ReactMarkdown>{project.content}</ReactMarkdown>
      </div>
    </article>
  )
}