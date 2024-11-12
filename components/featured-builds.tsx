'use client'

import * as React from "react"
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { fetchProjects } from '@/lib/github'
import type { ContentItem } from '@/lib/github'
import { Star } from 'lucide-react'

export default function FeaturedBuilds() {
  const [featuredProjects, setFeaturedProjects] = React.useState<ContentItem[]>([])
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [shouldShowProjects, setShouldShowProjects] = React.useState(true)

  React.useEffect(() => {
    async function loadFeaturedProjects() {
      const projects = await fetchProjects()
      setFeaturedProjects(projects.slice(0, 3))
    }
    loadFeaturedProjects()
  }, [])

  React.useEffect(() => {
    const updateVisibility = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        const cardWidth = 300 // Approximate width of each card including padding/margins
        const numberOfCards = 3
        const totalRequiredWidth = cardWidth * numberOfCards

        setShouldShowProjects(containerWidth >= totalRequiredWidth)
      }
    }

    updateVisibility()
    window.addEventListener('resize', updateVisibility)
    return () => {
      window.removeEventListener('resize', updateVisibility)
    }
  }, [])

  if (!shouldShowProjects) {
    return null
  }

  return (
    <div ref={containerRef} className="mb-16 hidden sm:block">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4 text-gray-800 dark:text-white">build-in-public log</h1>
        <p className="text-xl text-muted-foreground dark:text-gray-400">
          Some of my tools and experiments.
        </p>
      </div>
      <div className="flex justify-center">
        <div className="grid grid-cols-3 gap-6 max-w-6xl px-4 sm:px-0">
          {featuredProjects.map((project) => (
            <Card key={project.slug} className="overflow-hidden bg-white dark:bg-background shadow-lg rounded-xl transition-transform transform hover:scale-105 duration-300 w-[300px]">
              <div className="relative aspect-[12/9]">
                {project.image && (
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    className="object-cover rounded-t-xl"
                  />
                )}
              </div>
              <CardContent className="p-5">
                <div className="min-h-[100px] flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{project.title}</h3>
                    {project.type === 'book' && project.rating && (
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: Math.floor(project.rating) }, (_, i) => (
                          <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-500" />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-grow">
                    {project.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {project.tags?.slice(0, 3).map((tag) => (
                      <Badge 
                        key={tag} 
                        variant="secondary" 
                        className="text-xs py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full font-normal"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}cl