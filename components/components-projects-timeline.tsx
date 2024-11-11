'use client'

import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import matter from 'gray-matter'
import { motion } from 'framer-motion'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search } from "lucide-react"
import Link from 'next/link'

interface Project {
  title: string
  description: string
  date: string
  tags: string[]
  type: string
  category: string
  content: string
}

const octokit = new Octokit({ auth: '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' })

export function ProjectsTimelineComponent() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch projects effect remains the same...
  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await octokit.repos.getContent({
          owner: 'lukketsvane',
          repo: 'personal-web',
          path: '',
        })

        if (Array.isArray(response.data)) {
          const mdxFiles = response.data.filter(file => file.name.endsWith('.mdx'))
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
    <div className="flex min-h-screen bg-white">
      {/* Left Sidebar */}
      <div className="w-64 p-6 border-r border-gray-100">
        <div className="space-y-6">
          {/* Type Section */}
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">type</h2>
            <div className="flex flex-wrap gap-2">
              {['public', 'private', 'prototype', 'personal'].map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedType(selectedType === type ? null : type)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedType === type
                      ? 'bg-rose-50 text-rose-900'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Tutorials Section */}
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">tutorials</h2>
            <div className="flex flex-wrap gap-2">
              {['video', 'template', 'live tweet'].map(tutorial => (
                <button
                  key={tutorial}
                  className="px-3 py-1 rounded-full bg-green-50 text-green-900 text-sm"
                >
                  {tutorial}
                </button>
              ))}
            </div>
          </div>

          {/* Categories Section */}
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">categories</h2>
            <div className="flex flex-wrap gap-2">
              {['ai', 'no code', 'vc', 'web3', 'art', 'dev'].map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedCategory === category
                      ? 'bg-blue-50 text-blue-900'
                      : 'bg-blue-50/50 text-blue-900/50 hover:bg-blue-50'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="search"
              placeholder="Type here to search"
              className="w-full pl-10 border-gray-200 rounded-full h-12 text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Timeline */}
        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="relative pl-8">
            {/* Timeline Line */}
            <div className="absolute left-[11px] top-0 h-full w-[2px] bg-gray-100" />
            
            {/* Timeline Items */}
            {filteredProjects.map((project, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="mb-12 relative"
              >
                {/* Timeline Dot */}
                <div className="absolute left-0 top-2 w-6 h-6 rounded-full border-4 border-white bg-gray-100" />
                
                {/* Content */}
                <div className="pl-12">
                  {/* Date */}
                  <div className="text-base font-medium text-gray-900 mb-2">
                    {project.date}
                  </div>
                  
                  {/* Title */}
                  <Link href="#" className="group">
                    <h3 className="text-[#0066FF] text-xl font-medium mb-2 group-hover:underline">
                      {project.title}
                    </h3>
                  </Link>
                  
                  {/* Description */}
                  <p className="text-gray-600 mb-3">
                    {project.description}
                  </p>
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}