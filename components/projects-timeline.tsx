'use client'

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, ChevronLeft, ExternalLink, ChevronDown, ChevronUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Octokit } from "@octokit/rest"
import Link from "next/link"
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
  imagePaths: string[]
  url?: string
}

const octokit = new Octokit({ 
  auth: process.env.NEXT_PUBLIC_GITHUB_PAT || process.env.GITHUB_PAT 
})

const ImageComponent = ({ src, alt, width, height }) => {
  // Ensure the src starts with a forward slash
  const imageSrc = src.startsWith('/') ? src : `/${src}`
  
  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={width || 600}
      height={height || 400}
      className="rounded-lg shadow-md"
    />
  )
}

export default function ProjectsTimeline() {
  const [projects, setProjects] = React.useState<Project[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeFilters, setActiveFilters] = React.useState<string[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [expandedProject, setExpandedProject] = React.useState<Project | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [showAllTags, setShowAllTags] = React.useState(false)

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
                imagePaths,
                url: frontMatterObj.url || ''
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
        project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      
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

  const featuredProjects = React.useMemo(() => {
    return projects.slice(0, 3)
  }, [projects])

  const displayedTags = React.useMemo(() => {
    return showAllTags ? allTags : allTags.slice(0, 10)
  }, [allTags, showAllTags])

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-8">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">build-in-public log</h1>
          <p className="text-lg text-muted-foreground mb-8">some of my tools and experiments.</p>
          
          {/* Featured Projects */}
          <h2 className="text-2xl font-semibold text-primary mb-6">Featured Builds</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {featuredProjects.map((project, index) => (
              <Card key={index} className="overflow-hidden">
                <div className="aspect-video bg-muted">
                  {project.imagePaths[0] && (
                    <ImageComponent
                      src={project.imagePaths[0]}
                      alt={project.title}
                      width={400}
                      height={300}
                    />
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">{project.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{project.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {project.tags.slice(0, 3).map((tag, tagIndex) => (
                      <Badge key={tagIndex} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

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
                  {displayedTags.map(tag => (
                    <Badge
                      key={tag}
                      variant={activeFilters.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                      onClick={() => toggleFilter(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                  {allTags.length > 10 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllTags(!showAllTags)}
                      className="text-muted-foreground"
                    >
                      {showAllTags ? (
                        <>Show Less <ChevronUp className="ml-1 h-4 w-4" /></>
                      ) : (
                        <>Show More <ChevronDown className="ml-1 h-4 w-4" /></>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="min-h-screen">
            <div className="mb-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Type here to search"
                  className="pl-10 max-w-md"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="relative">
                <div className="absolute left-4 top-0 h-full w-px bg-border md:left-8" />
                <div className="space-y-12">
                  {filteredProjects.map((project, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.3 }}
                      className="relative pl-10 md:pl-16"
                    >
                      <div className="absolute left-[14px] top-[22px] h-3 w-3 rounded-full border-2 border-primary bg-background md:left-[30px]" />
                      <div className="flex flex-col gap-2">
                        <time className="text-sm text-muted-foreground">{project.date}</time>
                        <Card className="p-4 hover:shadow-md transition-shadow duration-200">
                          <h2 className="font-semibold hover:text-primary">
                            <button
                              className="text-left"
                              onClick={() => setExpandedProject(project)}
                            >
                              {project.title}
                            </button>
                          </h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {project.description}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {project.tags.map((tag, tagIndex) => (
                              <Badge key={tagIndex} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </Card>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </main>
        </div>
      </div>
      <Button 
        className="fixed bottom-6 right-6 bg-black text-white hover:bg-black/90"
      >
        Chat with Mini Yohei →
      </Button>

      <AnimatePresence mode="wait">
        {expandedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 overflow-y-auto"
          >
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="relative z-10 mx-auto max-w-4xl p-6 bg-background rounded-lg shadow-lg mt-20 mb-20"
            >
              <Button
                variant="ghost"
                className="mb-6"
                onClick={() => setExpandedProject(null)}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Timeline
              </Button>
              <div className="space-y-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="space-y-4"
                >
                  <time className="text-sm text-muted-foreground">{expandedProject.date}</time>
                  <h1 className="text-4xl font-bold">{expandedProject.title}</h1>
                  <div className="flex flex-wrap gap-2">
                    {expandedProject.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="prose prose-neutral dark:prose-invert max-w-none"
                >
                  <ReactMarkdown
                    components={{
                      img: ({ node, ...props }) => (
                        <ImageComponent {...props} />
                      ),
                      video: ({ node, ...props }) => (
                        <video
                          {...props}
                          style={{
                            width: "100%",
                            borderRadius: "8px",
                            marginTop: "20px",
                            marginBottom: "20px"
                          }}
                          className="rounded-lg shadow-md"
                        />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 className="text-2xl font-semibold mt-8 mb-4" {...props} />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-xl font-semibold mt-6 mb-3" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="mb-4 leading-relaxed" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc pl-6 mb-4" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="list-decimal pl-6 mb-4" {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li className="mb-2" {...props} />
                      ),
                      code: ({ node, inline, ...props }) => (
                        inline 
                          ? <code className="bg-muted px-1 py-0.5 rounded" {...props} />
                          : <pre className="bg-muted p-4 rounded-lg overflow-x-auto"><code {...props} /></pre>
                      ),
                    }}
                  >
                    {expandedProject.content}
                  </ReactMarkdown>
                </motion.div>
                {expandedProject.url && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.3 }}
                  >
                    <Button variant="outline" asChild>
                      <Link href={expandedProject.url} target="_blank">
                        View Project
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}