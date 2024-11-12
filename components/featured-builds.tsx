'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { fetchProjects } from '@/lib/github'
import type { ContentItem } from '@/lib/github'

export default function FeaturedBuilds() {
  const [featuredProjects, setFeaturedProjects] = useState<ContentItem[]>([])

  useEffect(() => {
    async function loadFeaturedProjects() {
      const projects = await fetchProjects()
      setFeaturedProjects(projects.slice(0, 3))
    }
    loadFeaturedProjects()
  }, [])

  return (
    <div className="mb-8 hidden sm:block">
      <h2 className="text-2xl font-bold text-center mb-4">Featured Builds</h2>
      <div className="grid grid-cols-3 gap-4">
        {featuredProjects.map((project) => (
          <Card key={project.slug} className="overflow-hidden w-64">
            <div className="relative aspect-[16/9]">
              {project.image && (
                <Image
                  src={project.image}
                  alt={project.title}
                  fill
                  className="object-cover"
                />
              )}
            </div>
            <CardContent className="p-3">
              <h3 className="text-lg font-semibold mb-1 truncate">{project.title}</h3>
              <p className="text-muted-foreground text-xs mb-2 line-clamp-2">{project.description}</p>
              <div className="flex flex-wrap gap-1">
                {project.category && (
                  <Badge variant="secondary" className="text-xs">
                    {project.category}
                  </Badge>
                )}
                {project.tags && project.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}