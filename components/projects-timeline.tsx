"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface Project {
  date: string
  title: string
  description: string
  tags: string[]
  href?: string
}

const projects: Project[] = [
  {
    date: "10/23/2024",
    title: "Building AI that Builds Itself",
    description: "A podcast with Dan Shipper (Every) where I demo ditto and babyagi 2o",
    tags: ["public", "video", "ai"],
    href: "#"
  },
  {
    date: "10/17/2024",
    title: "babyagi 2o",
    description: "The simplest self-building autonomous agent",
    tags: ["public", "ai"],
    href: "#"
  },
  {
    date: "10/15/2024",
    title: "ditto",
    description: "The simplest self-building coding agent",
    tags: ["public", "ai"],
    href: "#"
  },
  {
    date: "9/30/2024",
    title: "babyagi 2",
    description: "A framework for building self-building autonomous agents",
    tags: ["public", "ai"],
    href: "#"
  },
  {
    date: "9/9/2024",
    title: "Email stats by domain",
    description: "Find email relationships strengths with a list of orgs",
    tags: ["private", "vc"],
    href: "#"
  }
]

const filterCategories = {
  type: ["public", "private", "prototype", "personal"],
  tutorials: ["video", "template", "live tweet"],
  categories: ["ai", "no code", "vc", "web3", "art", "dev"]
}

export default function ProjectsTimeline() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeFilters, setActiveFilters] = React.useState<string[]>([])

  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (activeFilters.length === 0) return matchesSearch
    
    return matchesSearch && project.tags.some(tag => activeFilters.includes(tag))
  })

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    )
  }

  return (
    <div className="container mx-auto p-4 lg:p-8">
      <div className="grid gap-8 lg:grid-cols-[240px,1fr]">
        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>type</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {filterCategories.type.map(filter => (
                  <Badge
                    key={filter}
                    variant={activeFilters.includes(filter) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-muted-foreground/20"
                    onClick={() => toggleFilter(filter)}
                  >
                    {filter}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>tutorials</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {filterCategories.tutorials.map(filter => (
                  <Badge
                    key={filter}
                    variant={activeFilters.includes(filter) ? "default" : "outline"}
                    className="cursor-pointer bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                    onClick={() => toggleFilter(filter)}
                  >
                    {filter}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>categories</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {filterCategories.categories.map(filter => (
                  <Badge
                    key={filter}
                    variant={activeFilters.includes(filter) ? "default" : "outline"}
                    className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                    onClick={() => toggleFilter(filter)}
                  >
                    {filter}
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

          <div className="relative pl-8 border-l-2 border-muted space-y-12">
            {filteredProjects.map((project, index) => (
              <div key={index} className="relative">
                <div className="absolute -left-[41px] h-5 w-5 rounded-full border-4 border-background bg-muted" />
                <time className="block text-sm text-muted-foreground mb-2">
                  {project.date}
                </time>
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold">
                    <a 
                      href={project.href} 
                      className="text-blue-500 hover:text-blue-600 hover:underline"
                    >
                      {project.title}
                    </a>
                  </h3>
                  <p className="text-muted-foreground">
                    {project.description}
                  </p>
                  <div className="flex gap-2">
                    {project.tags.map(tag => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className={cn(
                          "cursor-pointer",
                          activeFilters.includes(tag) && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => toggleFilter(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <Button 
        className="fixed bottom-6 right-6 bg-black text-white hover:bg-black/90"
      >
        Chat with Mini Yohei →
      </Button>
    </div>
  )
}