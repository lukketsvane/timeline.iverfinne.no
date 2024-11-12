'use client'

import * as React from "react"
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { fetchProjects } from '@/lib/github'
import type { ContentItem } from '@/lib/github'

export default function FeaturedBuilds() {
  const [featuredProjects, setFeaturedProjects] = React.useState<ContentItem[]>([])

  React.useEffect(() => {
    async function loadFeaturedProjects() {
      const projects = await fetchProjects()
      setFeaturedProjects(projects.slice(0, 3))
    }
    loadFeaturedProjects()
  }, [])

  return (
    <div className="mb-16 hidden sm:block">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-2">build-in-public log</h1>
        <p className="text-xl text-muted-foreground">
          some of my tools and experiments.
        </p>
      </div>
      <div className="flex justify-center ">
        <div className="grid grid-cols-3 gap-2 max-w-5xl">
          {featuredProjects.map((project) => (
            <Card key={project.slug} className="overflow-hidden bg-white dark:bg-background shadow-sm w-[280px]">
              <div className="relative aspect-[12/9]">
                {project.image && (
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    className="object-cover"
                  />
                )}
              </div>
              <CardContent className="p-4">
                <div className="min-h-[100px] flex flex-col">
                  <h3 className="text-base font-semibold mb-2">{project.title}</h3>
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
}