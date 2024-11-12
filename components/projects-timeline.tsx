"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Octokit } from "@octokit/rest"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import ReactMarkdown from 'react-markdown'

interface Project {
  title: string
  description: string
  date: string
  tags: string[]
  type: string
  category: string
  content: string
  slug: string
  imagePaths: string[]
}

const octokit = new Octokit({ 
  auth: process.env.NEXT_PUBLIC_GITHUB_PAT || process.env.GITHUB_PAT 
})

export default function ProjectsTimeline() {
  const [projects, setProjects] = React.useState<Project[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeFilters, setActiveFilters] = React.useState<string[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [expandedProject, setExpandedProject] = React.useState<Project | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchProjects() {
      try {
        const [projectsData, writingData] = await Promise.all([
          octokit.repos.getContent({
            owner: 'lukketsvane',
            repo: 'personal-web',
            path: 'projects'
          }),
          octokit.repos.getContent({
            owner: 'lukketsvane',
            repo: 'personal-web',
            path: 'writing'
          })
        ])

        const allFiles = [
          ...Array.isArray(projectsData.data) ? projectsData.data : [],
          ...Array.isArray(writingData.data) ? writingData.data : []
        ].filter(file => file.type === 'file' && file.name.endsWith('.mdx'))

        const projectsContent = await Promise.all(
          allFiles.map(async (file) => {
            const { data } = await octokit.repos.getContent({
              owner: 'lukketsvane',
              repo: 'personal-web',
              path: file.path,
            })

            if ('content' in data) {
              const content = Buffer.from(data.content, 'base64').toString()
              const frontMatterRegex = /---\s*([\s\S]*?)\s*---/
              const frontMatterMatch = content.match(frontMatterRegex)
              const frontMatter = frontMatterMatch ? frontMatterMatch[1] : ''
              const mdContent = content.replace(frontMatterRegex, '').trim()

              const frontMatterObj = frontMatter.split('\n').reduce((acc, line) => {
                const [key, value] = line.split(':').map(str => str.trim())
                if (key && value) {
                  acc[key] = value.replace(/^['"](.*)['"]$/, '$1')
                }
                return acc
              }, {} as Record<string, string>)

              const imagePaths = await fetchImagePaths(file.path.split('/')[0])

              return {
                title: frontMatterObj.title || file.name.replace('.mdx', ''),
                description: frontMatterObj.description || '',
                date: frontMatterObj.date || new Date().toISOString().split('T')[0],
                tags: frontMatterObj.tags ? frontMatterObj.tags.split(',').map(tag => tag.trim()) : [],
                type: file.path.startsWith('projects/') ? 'project' : 'writing',
                category: frontMatterObj.category || file.path.split('/')[0],
                content: mdContent,
                slug: file.name.replace('.mdx', ''),
                imagePaths
              } as Project
            }
          })
        )

        const validProjects = projectsContent.filter(Boolean) as Project[]
        setProjects(validProjects.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
        setIsLoading(false)
      } catch (error) {
        console.error('Error fetching projects:', error)
        setError('Failed to load projects. Please try again later.')
        setIsLoading(false)
      }
    }

    async function fetchImagePaths(projectName: string) {
      try {
        const { data } = await octokit.repos.getContent({
          owner: 'lukketsvane',
          repo: 'personal-web',
          path: `images/${projectName}`
        })

        if (Array.isArray(data)) {
          return data
            .filter(file => file.type === 'file' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name))
            .map(file => file.download_url)
        }
        return []
      } catch (error) {
        console.error(`Error fetching images for ${projectName}:`, error)
        return []
      }
    }

    fetchProjects()
  }, [])

  const allTags = React.useMemo(() => {
    const tags = new Set<string>()
    projects.forEach(project => {
      project.tags.forEach(tag => tags.add(tag))
    })
    return Array.from(tags)
  }, [projects])

  const types = React.useMemo(() => 
    Array.from(new Set(projects.map(p => p.type))),
    [projects]
  )
  
  const categories = React.useMemo(() => 
    Array.from(new Set(projects.map(p => p.category))),
    [projects]
  )

  const filteredProjects = React.useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = 
        project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description.toLowerCase().includes(searchQuery.toLowerCase())
      
      if (activeFilters.length === 0) return matchesSearch
      
      return matchesSearch && (
        project.tags.some(tag => activeFilters.includes(tag)) ||
        activeFilters.includes(project.type) ||
        activeFilters.includes(project.category)
      )
    })
  }, [projects, searchQuery, activeFilters])

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-red-500">
        {error}
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        No projects found.
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 lg:p-8">
      <div className="grid gap-8 lg:grid-cols-[240px,1fr]">
        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>type</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {types.map(type => (
                  <Badge
                    key={type}
                    variant={activeFilters.includes(type) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-muted-foreground/20"
                    onClick={() => toggleFilter(type)}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>categories</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {categories.map(category => (
                  <Badge
                    key={category}
                    variant={activeFilters.includes(category) ? "default" : "outline"}
                    className="cursor-pointer bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                    onClick={() => toggleFilter(category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>tags</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={activeFilters.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                    onClick={() => toggleFilter(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="min-h-screen">
          <div className="relative mb-8">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Type here to search"
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="relative pl-8 border-l-2 border-muted space-y-12">
            {filteredProjects.map((project, index) => (
              <div key={index} className="relative">
                <div className="absolute -left-[41px] h-5 w-5 rounded-full border-4 border-background bg-muted" />
                <time className="block text-sm text-muted-foreground mb-2">
                  {project.date}
                </time>
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold">
                    {project.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {project.description}
                  </p>
                  <div className="flex gap-2">
                    {project.tags.map(tag => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className={cn(
                          "cursor-pointer",
                          activeFilters.includes(tag) && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => toggleFilter(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  {project.imagePaths.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {project.imagePaths.slice(0, 3).map((imagePath, index) => (
                        <img
                          key={index}
                          src={imagePath}
                          alt={`${project.title} image ${index + 1}`}
                          className="w-24 h-24 object-cover rounded"
                        />
                      ))}
                    </div>
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" onClick={() => setExpandedProject(project)}>
                        Read more
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>{expandedProject?.title}</DialogTitle>
                        <DialogDescription>
                          {expandedProject?.date} - {expandedProject?.category}
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="mt-4 h-full max-h-[calc(80vh-100px)]">
                        <div className="prose dark:prose-invert max-w-none">
                          <ReactMarkdown>
                            {expandedProject?.content || ''}
                          </ReactMarkdown>
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <Button 
        className="fixed bottom-6 right-6 bg-black text-white hover:bg-black/90"
      >
        Chat with Mini Yohei →
      </Button>
    </div>
  )
}