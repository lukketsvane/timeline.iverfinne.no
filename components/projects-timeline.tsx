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
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'

interface Project {
  title: string
  description: string
  date: string
  tags: string[]
  type: string
  category: string
  content: string
  slug: string
  images: string[]
}

const octokit = new Octokit({ auth: process.env.NEXT_PUBLIC_GITHUB_PAT })

export default function ProjectsTimeline() {
  const [projects, setProjects] = React.useState<Project[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeFilters, setActiveFilters] = React.useState<string[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [expandedProject, setExpandedProject] = React.useState<Project | null>(null)

  React.useEffect(() => {
    async function fetchProjects() {
      try {
        console.log('Fetching projects...')
        const { data: projectsData } = await octokit.repos.getContent({
          owner: 'lukketsvane',
          repo: 'personal-web',
          path: 'projects'
        })
        console.log('Projects data:', projectsData)

        console.log('Fetching writing...')
        const { data: writingData } = await octokit.repos.getContent({
          owner: 'lukketsvane',
          repo: 'personal-web',
          path: 'writing'
        })
        console.log('Writing data:', writingData)

        const allFiles = [...projectsData, ...writingData].filter(file => file.type === 'file' && file.name.endsWith('.mdx'))
        console.log('All files:', allFiles)

        const projectsContent = await Promise.all(
          allFiles.map(async (file) => {
            console.log(`Processing file: ${file.path}`)
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
                  acc[key] = value.replace(/^['"](.*)['"]$/, '$1') // Remove quotes if present
                }
                return acc
              }, {} as Record<string, string>)

              const projectName = file.path.split('/').pop()?.replace('.mdx', '') || ''
              const projectImages = await fetchProjectImages(projectName)

              console.log(`Processed ${file.path}`)
              return {
                title: frontMatterObj.title || file.name.replace('.mdx', ''),
                description: frontMatterObj.description || '',
                date: frontMatterObj.date || 'No date',
                tags: frontMatterObj.tags ? frontMatterObj.tags.split(',').map(tag => tag.trim()) : [],
                type: frontMatterObj.type || 'public',
                category: frontMatterObj.category || 'uncategorized',
                content: mdContent,
                slug: file.name.replace('.mdx', ''),
                images: projectImages
              } as Project
            }
            console.log(`Skipped ${file.path} (no content)`)
            return null
          })
        )

        const filteredProjects = projectsContent.filter(Boolean) as Project[]
        console.log('Filtered projects:', filteredProjects)

        setProjects(filteredProjects)
        setIsLoading(false)
      } catch (error) {
        console.error('Error fetching projects:', error)
        setIsLoading(false)
      }
    }

    fetchProjects()
  }, [])

  async function fetchProjectImages(projectName: string) {
    try {
      const { data: imageFiles } = await octokit.repos.getContent({
        owner: 'lukketsvane',
        repo: 'personal-web',
        path: `images/${projectName}`
      })

      if (Array.isArray(imageFiles)) {
        return imageFiles
          .filter(file => file.type === 'file' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name))
          .map(file => file.download_url)
      }
    } catch (error) {
      console.error(`Error fetching images for ${projectName}:`, error)
    }
    return []
  }

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
    return <div className="flex justify-center items-center h-screen">Loading projects...</div>
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <p className="text-xl font-semibold mb-4">No projects found.</p>
        <p className="text-muted-foreground">
          Please check the console for error messages and ensure your GitHub token is correct.
        </p>
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
              <Label>Type</Label>
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
              <Label>Categories</Label>
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
              <Label>Tags</Label>
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

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project, index) => (
              <Card 
                key={index} 
                className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
                onClick={() => setExpandedProject(project)}
              >
                <CardHeader>
                  <CardTitle>{project.title}</CardTitle>
                  <time className="text-sm text-muted-foreground">
                    {project.date}
                  </time>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {project.description}
                  </p>
                  {project.images.length > 0 && (
                    <div className="relative w-full h-48 rounded-lg overflow-hidden mb-4">
                      <Image
                        src={project.images[0]}
                        alt={project.title}
                        layout="fill"
                        objectFit="cover"
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map(tag => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className={cn(
                          "cursor-pointer",
                          activeFilters.includes(tag) && "bg-primary text-primary-foreground"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFilter(tag);
                        }}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>

      <Dialog open={!!expandedProject} onOpenChange={() => setExpandedProject(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{expandedProject?.title}</DialogTitle>
            <DialogDescription>
              {expandedProject?.date} - {expandedProject?.category}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="mt-4 h-full max-h-[calc(80vh-100px)]">
            <ReactMarkdown 
              className="prose dark:prose-invert"
              components={{
                img: ({node, ...props}) => (
                  <Image
                    src={props.src || ''}
                    alt={props.alt || ''}
                    width={600}
                    height={400}
                    className="rounded-lg"
                  />
                ),
              }}
            >
              {expandedProject?.content || ''}
            </ReactMarkdown>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Button 
        className="fixed bottom-6 right-6 bg-black text-white hover:bg-black/90"
      >
        Chat with Mini Yohei →
      </Button>
    </div>
  )
}