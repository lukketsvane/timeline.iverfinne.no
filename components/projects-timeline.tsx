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
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'
import Link from 'next/link'
import { format, parse } from 'date-fns'

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
        const { data: projectsData } = await octokit.repos.getContent({
          owner: 'lukketsvane',
          repo: 'personal-web',
          path: 'projects'
        })

        const { data: writingData } = await octokit.repos.getContent({
          owner: 'lukketsvane',
          repo: 'personal-web',
          path: 'writing'
        })

        const allFiles = [...projectsData, ...writingData].filter(file => file.type === 'file' && file.name.endsWith('.mdx'))

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

              const projectName = file.path.split('/').pop()?.replace('.mdx', '') || ''
              const projectImages = await fetchProjectImages(projectName)

              const formattedDate = frontMatterObj.date 
                ? format(parse(frontMatterObj.date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')
                : 'No date'

              return {
                title: frontMatterObj.title || file.name.replace('.mdx', ''),
                description: frontMatterObj.description || '',
                date: formattedDate,
                tags: frontMatterObj.tags ? frontMatterObj.tags.split(',').map(tag => tag.trim()) : [],
                type: frontMatterObj.type || 'public',
                category: frontMatterObj.category || 'uncategorized',
                content: mdContent,
                slug: file.name.replace('.mdx', ''),
                images: projectImages
              } as Project
            }
            return null
          })
        )

        const filteredProjects = projectsContent.filter(Boolean) as Project[]
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

  const types = ["public", "private", "prototype", "personal"]
  const tutorials = ["video", "template", "live tweet"]
  const categories = ["ai", "no code", "vc", "web3", "art", "dev"]

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

  return (
    <div className="container mx-auto p-4 lg:p-8">
      <div className="grid gap-8 lg:grid-cols-[240px,1fr]">
        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">type</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {types.map(type => (
                  <Badge
                    key={type}
                    variant={activeFilters.includes(type) ? "default" : "outline"}
                    className="cursor-pointer bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                    onClick={() => toggleFilter(type)}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">tutorials</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {tutorials.map(tutorial => (
                  <Badge
                    key={tutorial}
                    variant={activeFilters.includes(tutorial) ? "default" : "outline"}
                    className="cursor-pointer bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                    onClick={() => toggleFilter(tutorial)}
                  >
                    {tutorial}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">categories</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {categories.map(category => (
                  <Badge
                    key={category}
                    variant={activeFilters.includes(category) ? "default" : "outline"}
                    className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                    onClick={() => toggleFilter(category)}
                  >
                    {category}
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
              className="pl-10 rounded-full border-gray-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="relative pl-8 border-l-2 border-gray-200 space-y-12">
            {filteredProjects.map((project, index) => (
              <div key={index} className="relative">
                <div className="absolute -left-[41px] h-5 w-5 rounded-full border-4 border-white bg-gray-200" />
                <time className="block text-sm text-gray-500 mb-2">
                  {project.date}
                </time>
                <div 
                  className="space-y-2 cursor-pointer border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
                  onClick={() => setExpandedProject(project)}
                >
                  <h3 className="text-xl font-semibold text-gray-900 hover:text-gray-700">
                    {project.title}
                  </h3>
                  <p className="text-gray-600">
                    {project.description}
                  </p>
                  <div className="flex gap-2">
                    {project.tags.map(tag => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="bg-gray-50 text-gray-600 border-gray-200"
                      >
                        {tag.replace(/[\[\]]/g, '').trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
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
        className="fixed bottom-6 right-6 bg-black text-white hover:bg-black/90 rounded-none px-6"
      >
        Chat with Mini Yohei →
      </Button>
    </div>
  )
}