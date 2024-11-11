'use client'

import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import matter from 'gray-matter'
import { motion } from 'framer-motion'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search } from "lucide-react"

interface Project {
  title: string
  description: string
  date: string
  tags: string[]
  type: string
  category: string
  content: string
  image?: string
}

const octokit = new Octokit({ auth: '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' })

export default function ProjectsTimeline() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProjects() {
      try {
        const projectsResponse = await octokit.repos.getContent({
          owner: 'lukketsvane',
          repo: 'personal-web',
          path: 'projects',
        })

        const writingResponse = await octokit.repos.getContent({
          owner: 'lukketsvane',
          repo: 'personal-web',
          path: 'writing',
        })

        if (Array.isArray(projectsResponse.data) && Array.isArray(writingResponse.data)) {
          const mdxFiles = [...projectsResponse.data, ...writingResponse.data].filter(file => file.name.endsWith('.mdx'))
          const projectPromises = mdxFiles.map(async file => {
            const content = await octokit.repos.getContent({
              owner: 'lukketsvane',
              repo: 'personal-web',
              path: file.path,
            })

            if ('content' in content.data) {
              const decodedContent = Buffer.from(content.data.content, 'base64').toString('utf8')
              const { data, content: mdxContent } = matter(decodedContent)
              return {
                title: data.title || file.name.replace('.mdx', ''),
                description: data.description || '',
                date: data.date || 'No date',
                tags: data.tags || [],
                type: data.type || 'public',
                category: data.category || 'uncategorized',
                content: mdxContent,
                image: data.image || '',
              }
            }
          })

          const fetchedProjects = await Promise.all(projectPromises)
          setProjects(fetchedProjects.filter(Boolean) as Project[])
          setFilteredProjects(fetchedProjects.filter(Boolean) as Project[])
        }
      } catch (err) {
        console.error('Error fetching projects:', err)
        setError('Failed to load projects. Please try again later.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjects()
  }, [])

  useEffect(() => {
    const filtered = projects.filter(project => 
      (project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
       project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
       project.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))) &&
      (!selectedType || project.type === selectedType) &&
      (!selectedCategory || project.category === selectedCategory)
    )
    setFilteredProjects(filtered)
  }, [searchTerm, selectedType, selectedCategory, projects])

  if (isLoading) return <div className="flex justify-center items-center h-screen">Loading...</div>
  if (error) return <div className="flex justify-center items-center h-screen text-red-500">{error}</div>

  return (
    <div className="flex min-h-screen bg-background">
      <div className="w-64 p-4 border-r">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">Type</h3>
          <div className="space-y-2">
            {['public', 'private', 'prototype', 'personal'].map(type => (
              <Button
                key={type}
                variant={selectedType === type ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setSelectedType(selectedType === type ? null : type)}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">Categories</h3>
          <div className="space-y-2">
            {['ai', 'no code', 'vc', 'web3', 'art', 'dev'].map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Type here to search"
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="relative pl-8">
            <div className="absolute left-4 top-0 h-full w-px bg-border" />
            {filteredProjects.map((project, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className="mb-8 relative"
              >
                <div className="absolute left-0 top-6 w-3 h-3 bg-primary rounded-full -translate-x-[5px]" />
                <div className={`pl-8 ${index % 2 === 0 ? 'pr-12' : 'pl-12 pr-8'}`}>
                  <time className="text-sm text-muted-foreground">{project.date}</time>
                  <Card className="p-4 mt-2">
                    <h3 className="text-xl font-semibold text-primary">{project.title}</h3>
                    <p className="mt-2 text-muted-foreground">{project.description}</p>
                    {project.image && (
                      <img src={project.image} alt={project.title} className="mt-4 rounded-md w-full h-40 object-cover" />
                    )}
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
        </ScrollArea>
      </div>
    </div>
  )
}