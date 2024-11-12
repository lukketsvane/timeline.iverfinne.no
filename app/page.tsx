'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import ProjectsTimeline from '../components/projects-timeline'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Project } from "@/lib/github"
import { fetchProjects } from "@/lib/github"

export default function Home() {
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([])

  useEffect(() => {
    const loadFeaturedProjects = async () => {
      const allProjects = await fetchProjects()
      setFeaturedProjects(allProjects.slice(0, 3))
    }
    loadFeaturedProjects()
  }, [])

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">build-in-public log</h1>
          <p className="text-lg text-muted-foreground mb-8">some of my tools and experiments.</p>
          
          <h2 className="text-2xl font-semibold text-primary mb-6">Featured Builds</h2>
          <div className="hidden md:grid grid-cols-3 gap-6 mb-12">
            {featuredProjects.map((project, index) => (
              <motion.div
                key={project.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
              >
                <Card className="overflow-hidden">
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
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <ProjectsTimeline />
    </main>
  )
}