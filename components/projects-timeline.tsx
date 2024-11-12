'use client'

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, ChevronLeft, ChevronDown, ChevronUp, Share2, Book, Pen, Code, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'
import { fetchProjects, fetchWritings, fetchBooks, ContentItem } from "@/lib/github"

const categoryColors = {
  project: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200",
  writing: "bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200",
  book: "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
}

const selectedCategoryColors = {
  project: "bg-emerald-500 hover:bg-emerald-600 text-white",
  writing: "bg-violet-500 hover:bg-violet-600 text-white",
  book: "bg-amber-500 hover:bg-amber-600 text-white"
}

function extractImageUrl(htmlString: string) {
  const match = htmlString.match(/src="([^"]+)"/)
  return match ? match[1] : null
}

interface RatingProps {
  rating: number;
}

const Rating: React.FC<RatingProps> = ({ rating }) => {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5
  
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-amber-500 text-amber-500" />
      ))}
      {hasHalfStar && <Star className="w-4 h-4 fill-amber-500 text-amber-500" />}
      {[...Array(5 - Math.ceil(rating))].map((_, i) => (
        <Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />
      ))}
    </div>
  )
}

export default function ProjectsTimeline({ initialSlug }: { initialSlug?: string }) {
  const [entries, setEntries] = React.useState<ContentItem[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeFilters, setActiveFilters] = React.useState<string[]>([])
  const [activeCategories, setActiveCategories] = React.useState<string[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [expandedEntry, setExpandedEntry] = React.useState<ContentItem | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [showAllTags, setShowAllTags] = React.useState(false)

  React.useEffect(() => {
    async function loadEntries() {
      try {
        const [projects, writings, books] = await Promise.all([
          fetchProjects(),
          fetchWritings(),
          fetchBooks()
        ])
        
        const allEntries: ContentItem[] = [...projects, ...writings, ...books]
          .map(entry => ({
            ...entry,
            date: new Date(entry.date).getTime() ? new Date(entry.date) : new Date(0)
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime())

        setEntries(allEntries)
        setIsLoading(false)
      } catch (error) {
        console.error('Error fetching entries:', error)
        setError('Failed to load content. Please try again later.')
        setIsLoading(false)
      }
    }

    loadEntries()
  }, [])

  React.useEffect(() => {
    if (initialSlug && entries.length > 0) {
      const entry = entries.find(e => e.slug === initialSlug)
      if (entry) {
        setExpandedEntry(entry)
      }
    }
  }, [initialSlug, entries])

  const allTags = React.useMemo(() => {
    const tags = new Set<string>()
    entries.forEach(entry => {
      entry.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags)
  }, [entries])

  const filteredEntries = React.useMemo(() => {
    return entries.filter(entry => {
      const matchesSearch = 
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesCategory = activeCategories.length === 0 || activeCategories.includes(entry.type)
      
      const matchesFilter = activeFilters.length === 0 || 
        entry.tags?.some(tag => activeFilters.includes(tag))
      
      return matchesSearch && matchesCategory && matchesFilter
    })
  }, [entries, searchQuery, activeFilters, activeCategories])

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    )
  }

  const toggleCategory = (category: string) => {
    setActiveCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const displayedTags = React.useMemo(() => {
    return showAllTags ? allTags : allTags.slice(0, 10)
  }, [allTags, showAllTags])

  const handleEntryClick = (entry: ContentItem) => {
    setExpandedEntry(entry)
    window.history.pushState(null, '', `/${entry.type}/${entry.slug}`)
  }

  const handleShareClick = (entry: ContentItem) => {
    const url = `${window.location.origin}/${entry.type}/${entry.slug}`
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied to clipboard!')
    }).catch(err => {
      console.error('Failed to copy link: ', err)
    })
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }).format(date)
  }

  const getEntryIcon = (type: ContentItem['type']) => {
    switch (type) {
      case 'project':
        return <Code className="w-4 h-4" />
      case 'writing':
        return <Pen className="w-4 h-4" />
      case 'book':
        return <Book className="w-4 h-4" />
    }
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
    <div className="bg-background">
      <div className="container mx-auto p-4 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[240px,1fr]">
          <aside className="space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Type here to search"
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="space-y-4">
              <div>
                <Label className="text-base">Categories</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['project', 'writing', 'book'].map((category) => (
                    <Badge
                      key={category}
                      className={`cursor-pointer transition-colors ${
                        activeCategories.includes(category)
                          ? selectedCategoryColors[category]
                          : categoryColors[category]
                      }`}
                      onClick={() => toggleCategory(category)}
                    >
                      <span className="flex items-center gap-1.5">
                        {getEntryIcon(category)}
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base">Tags</Label>
                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                  <div className="flex flex-wrap gap-2">
                    {displayedTags.map(tag => (
                      <Badge
                        key={tag}
                        className={`cursor-pointer transition-colors ${
                          activeFilters.includes(tag)
                            ? "bg-gray-900 hover:bg-gray-800 text-white"
                            : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                        }`}
                        onClick={() => toggleFilter(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
                {allTags.length > 10 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllTags(!showAllTags)}
                    className="mt-2 text-muted-foreground"
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
          </aside>

          <main>
            <div className="relative">
              <div className="absolute left-16 top-0 h-full w-px bg-border" />
              <div className="space-y-12">
                {filteredEntries.map((entry, index) => (
                  <motion.div
                    key={entry.slug}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                    className="relative pl-32"
                  >
                    <time className="absolute left-0 top-0 text-sm font-medium text-muted-foreground">
                      {formatDate(entry.date)}
                    </time>
                    <div className="absolute left-[62px] top-[10px] h-3 w-3 rounded-full border-2 border-primary bg-background" />
                    <Card className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-2">
                          {getEntryIcon(entry.type)}
                          <span className={`text-sm font-medium capitalize ${
                            categoryColors[entry.type].split(' ')[2]
                          }`}>
                            {entry.type}
                          </span>
                        </div>
                        <h2 className="text-xl font-semibold text-blue-500 hover:text-blue-600 transition-colors">
                          <button className="text-left" onClick={() => handleEntryClick(entry)}>
                            {entry.title}
                          </button>
                        </h2>
                        {entry.type === 'book' && entry.rating && (
                          <div className="mt-2">
                            <Rating rating={entry.rating} />
                          </div>
                        )}
                        {entry.image && (
                          <div className="relative w-full h-48 my-4">
                            <Image
                              src={extractImageUrl(entry.image) || entry.image}
                              alt={entry.title}
                              fill
                              className="object-cover rounded-lg"
                            />
                          </div>
                        )}
                        <p className="text-muted-foreground">
                          {entry.description}
                        </p>
                        <ScrollArea className="w-full whitespace-nowrap mt-4">
                          <div className="flex gap-2">
                            {entry.tags?.map((tag, tagIndex) => (
                              <Badge 
                                key={tagIndex} 
                                className="bg-gray-50 text-gray-700 shrink-0"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </ScrollArea>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-4"
                          onClick={() => handleShareClick(entry)}
                        >
                          <Share2 className="mr-2 h-4 w-4" />
                          Share
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>

      <Button 
        className="fixed bottom-6 right-6 bg-black text-white hover:bg-black/90"
      >
        Chat with Mini Iver →
      </Button>

      <AnimatePresence mode="wait">
        {expandedEntry && (
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
                  setExpandedEntry(null)
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
                  <div className="flex items-center gap-2">
                    {getEntryIcon(expandedEntry.type)}
                    <span className="text-sm font-medium capitalize">{expandedEntry.type}</span>
                  </div>
                  <time className="text-sm text-muted-foreground">{formatDate(expandedEntry.date)}</time>
                  <h1 className="text-4xl font-bold">{expandedEntry.title}</h1>
                  {expandedEntry.type === 'book' && expandedEntry.rating && (
                    <Rating rating={expandedEntry.rating} />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {expandedEntry.tags?.map((tag, index) => (
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
                          : `/images/${props.src}`
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
                      video: ({ src, ...props }) => (
                        <video
                          src={src}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full rounded-lg shadow-md my-5"
                          style={{
                            borderRadius: "8px",
                          }}
                          {...props}
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
                    {expandedEntry.content}
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