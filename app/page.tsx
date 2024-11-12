'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import ProjectsTimeline from '@/components/projects-timeline'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Project } from "@/lib/github"
import { fetchProjects } from "@/lib/github"
import Image from 'next/image'

function extractImageUrl(htmlString: string) {
  const match = htmlString.match(/src="([^"]+)"/)
  return match ? match[1] : null
}

export default function Home() {
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadFeaturedProjects = async () => {
      try {
        const allProjects = await fetchProjects()
        setFeaturedProjects(allProjects.slice(0, 3))
      } catch (error) {
        console.error('Error loading featured projects:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadFeaturedProjects()
  }, [])

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">build-in-public log</h1>
          <p className="text-lg text-muted-foreground mb-8">some of my tools and experiments.</p>
          
          <h2 className="text-2xl font-semibold mb-6">Featured Builds</h2>
          <div className="hidden md:grid grid-cols-3 gap-6 mb-12">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2 animate-pulse" />
                    <div className="h-16 bg-muted rounded mb-4 animate-pulse" />
                    <div className="flex gap-2">
                      <div className="h-6 bg-muted rounded w-16 animate-pulse" />
                      <div className="h-6 bg-muted rounded w-16 animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              featuredProjects.map((project, index) => (
                <motion.div
                  key={project.slug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.2 }}
                >
                  <Card className="overflow-hidden">
                    <CardContent className="p-4">
                      {project.image && (
                        <div className="relative w-full h-40 mb-4">
                          <Image
                            src={extractImageUrl(project.image) || project.image}
                            alt={project.title}
                            fill
                            className="object-cover rounded-md"
                          />
                        </div>
                      )}
                      <h3 className="font-semibold mb-2">{project.title}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{project.description}</p>
                      <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex gap-2">
                          {project.tags.map((tag, tagIndex) => (
                            <Badge key={tagIndex} variant="secondary" className="shrink-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
      <ProjectsTimeline />
    </main>
  )
}