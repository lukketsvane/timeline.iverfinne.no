'use client'

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, ChevronLeft, ExternalLink, ChevronDown, ChevronUp, Share2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Octokit } from "@octokit/rest"
import Link from "next/link"
import { useRouter, usePathname } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'
import { Project } from "@/lib/github"

const octokit = new Octokit({ 
  auth: process.env.NEXT_PUBLIC_GITHUB_PAT || process.env.GITHUB_PAT 
})

interface ImageGridProps {
  images: string[]
}

const ImageGrid: React.FC<ImageGridProps> = ({ images }) => {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="w-full md:w-[calc(50%-0.5rem)]">
        {images.slice(0, Math.ceil(images.length / 2)).map((src, index) => (
          <div key={index} className="mb-4 last:mb-0">
            <Image
              src={src}
              alt={`Gradient Image ${index * 2 + 1}`}
              width={600}
              height={400}
              className="w-full rounded-lg"
            />
          </div>
        ))}
      </div>
      <div className="w-full md:w-[calc(50%-0.5rem)]">
        {images.slice(Math.ceil(images.length / 2)).map((src, index) => (
          <div key={index} className="mb-4 last:mb-0">
            <Image
              src={src}
              alt={`Gradient Image ${index * 2 + 2}`}
              width={600}
              height={400}
              className="w-full rounded-lg"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProjectsTimeline({ initialSlug }: { initialSlug?: string }) {
  const [projects, setProjects] = React.useState<Project[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeFilters, setActiveFilters] = React.useState<string[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [expandedProject, setExpandedProject] = React.useState<Project | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [showAllTags, setShowAllTags] = React.useState(false)
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    async function fetchProjects() {
      try {
        const fetchedProjects = await octokit.repos.getContent({
          owner: 'lukketsvane',
          repo: 'personal-web',
          path: 'projects'
        })

        if (Array.isArray(fetchedProjects.data)) {
          const projectsData = await Promise.all(
            fetchedProjects.data
              .filter(file => file.type === 'file' && file.name.endsWith('.mdx'))
              .map(async (file) => {
                const { data } = await octokit.repos.getContent({
                  owner: 'lukketsvane',
                  repo: 'personal-web',
                  path: file.path,
                })

                if ('content' in data) {
                  const content = Buffer.from(data.content, 'base64').toString()
                  const [, frontMatter, mdContent] = content.split('---')
                  const frontMatterObj = Object.fromEntries(
                    frontMatter.trim().split('\n').map(line => {
                      const [key, ...valueParts] = line.split(':')
                      return [key.trim(), valueParts.join(':').trim()]
                    })
                  )

                  return {
                    title: frontMatterObj.title || file.name.replace('.mdx', ''),
                    description: frontMatterObj.description || '',
                    date: frontMatterObj.date || new Date().toISOString().split('T')[0],
                    tags: frontMatterObj.tags ? frontMatterObj.tags.split(',').map(tag => tag.trim()) : [],
                    slug: file.name.replace('.mdx', ''),
                    content: mdContent.trim()
                  } as Project
                }
              })
          )

          setProjects(projectsData.filter((project): project is Project => project !== undefined))
        }
        setIsLoading(false)
      } catch (error) {
        console.error('Error fetching projects:', error)
        setError('Failed to load projects. Please try again later.')
        setIsLoading(false)
      }
    }

    fetchProjects()
  }, [])

  React.useEffect(() => {
    if (initialSlug && projects.length > 0) {
      const project = projects.find(p => p.slug === initialSlug)
      if (project) {
        setExpandedProject(project)
      }
    }
  }, [initialSlug, projects])

  React.useEffect(() => {
    const slug = pathname.split('/').pop()
    if (slug) {
      const project = projects.find(p => p.slug === slug)
      if (project) {
        setExpandedProject(project)
      }
    }
  }, [pathname, projects])

  const allTags = React.useMemo(() => {
    const tags = new Set<string>()
    projects.forEach(project => {
      project.tags.forEach(tag => tags.add(tag))
    })
    return Array.from(tags)
  }, [projects])

  const filteredProjects = React.useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = 
        project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      
      if (activeFilters.length === 0) return matchesSearch
      
      return matchesSearch && (
        project.tags.some(tag => activeFilters.includes(tag))
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

  const handleProjectClick = (project: Project) => {
    setExpandedProject(project)
    window.history.pushState(null, '', `/${project.slug}`)
  }

  const handleShareClick = (project: Project) => {
    const url = `${window.location.origin}/${project.slug}`
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied to clipboard!')
    }).catch(err => {
      console.error('Failed to copy link: ', err)
    })
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">build-in-public log</h1>
          <p className="text-lg text-muted-foreground mb-8">some of my tools and experiments.</p>
          
          <h2 className="text-2xl font-semibold text-primary mb-6">Featured Builds</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {featuredProjects.map((project, index) => (
              <Card key={index} className="overflow-hidden">
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
          <aside className="space-y-6">
            <div className="space-y-4">
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
                              onClick={() => handleProjectClick(project)}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => handleShareClick(project)}
                          >
                            <Share2 className="mr-2 h-4 w-4" />
                            Share
                          </Button>
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
                onClick={() => {
                  setExpandedProject(null)
                  window.history.pushState(null, '', '/')
                }}
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
                      img: ({ ...props }) => (
                        <Image
                          {...props}
                          src={props.src || ''}
                          alt={props.alt || ''}
                          width={600}
                          height={400}
                          className="rounded-lg shadow-md"
                        />
                      ),
                      video: ({ ...props }) => (
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
                      h2: ({ ...props }) => (
                        <h2 className="text-2xl font-semibold mt-8 mb-4" {...props} />
                      ),
                      h3: ({ ...props }) => (
                        <h3 className="text-xl font-semibold mt-6 mb-3" {...props} />
                      ),
                      p: ({ ...props }) => (
                        <p className="mb-4 leading-relaxed" {...props} />
                      ),
                      ul: ({ ...props }) => (
                        <ul className="list-disc pl-6 mb-4" {...props} />
                      ),
                      ol: ({ ...props }) => (
                        <ol className="list-decimal pl-6 mb-4" {...props} />
                      ),
                      li: ({ ...props }) => (
                        <li className="mb-2" {...props} />
                      ),
                      code: ({ className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '')
                        return match ? (
                          <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        ) : (
                          <code className="bg-muted px-1 py-0.5 rounded" {...props}>
                            {children}
                          </code>
                        )
                      },
                    }}
                  >
                    {expandedProject.content}
                  </ReactMarkdown>
                </motion.div>
              </div>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}