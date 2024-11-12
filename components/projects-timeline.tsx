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
import Link from "next/link"
import { useRouter, usePathname } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'
import { Project, fetchProjects } from "@/lib/github"

interface ImageGridProps {
  images: {
    src: string;
    alt: string;
    caption: string;
  }[];
}

const ImageGrid: React.FC<ImageGridProps> = ({ images }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {images.map((image, index) => (
        <div key={index} className="flex flex-col items-center">
          <div className="relative w-full aspect-video">
            <Image
              src={image.src}
              alt={image.alt}
              layout="fill"
              objectFit="cover"
              className="rounded-lg"
            />
          </div>
          <p className="mt-2 text-sm text-center">{image.caption}</p>
        </div>
      ))}
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
    async function loadProjects() {
      try {
        const fetchedProjects = await fetchProjects()
        setProjects(fetchedProjects)
        setIsLoading(false)
      } catch (error) {
        console.error('Error fetching projects:', error)
        setError('Failed to load projects. Please try again later.')
        setIsLoading(false)
      }
    }

    loadProjects()
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
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
                        <time className="text-sm text-muted-foreground">{formatDate(project.date)}</time>
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
        Chat with Mini Iver →
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
                  <time className="text-sm text-muted-foreground">{formatDate(expandedProject.date)}</time>
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
                      img: ({ ...props }) => {
                        const src = props.src?.startsWith('/') 
                          ? props.src 
                          : `/${props.src}`
                        return (
                          <Image
                            src={src}
                            alt={props.alt || ''}
                            width={600}
                            height={400}
                            className="rounded-lg shadow-md"
                          />
                        )
                      },
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
                <ImageGrid
                  images={[
                    { src: "/public/images/coral/coral_1.gif", alt: "Innovative Design Process", caption: "Innovative Design Process" },
                    { src: "/public/images/coral/coral_11.png", alt: "Optimized Product Design", caption: "Optimized Product Design" },
                    { src: "/public/images/coral/coral_2.gif", alt: "Automated Workflow Application", caption: "Automated Workflow Application" },
                    { src: "/public/images/coral/coral_5.gif", alt: "AI-Driven Design Optimization", caption: "AI-Driven Design Optimization" },
                    { src: "/public/images/coral/coral_1.gif", alt: "Innovative Design Process", caption: "Innovative Design Process" },
                    { src: "/public/images/coral/coral_11.png", alt: "Optimized Product Design", caption: "Optimized Product Design" },
                    { src: "/public/images/coral/coral_2.gif", alt: "Automated Workflow Application", caption: "Automated Workflow Application" },
                    { src: "/public/images/coral/coral_5.gif", alt: "AI-Driven Design Optimization", caption: "AI-Driven Design Optimization" },
                  ]}
                />
              </div>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}