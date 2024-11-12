'use client'

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Share2, Book, Pen, Code, Star, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'
import { fetchProjects, fetchWritings, fetchBooks, fetchOutgoingLinks, ContentItem } from "@/lib/github"

const categoryColors = {
  project: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200",
  writing: "bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200",
  book: "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200",
  outgoing_link: "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
}

const selectedCategoryColors = {
  project: "bg-emerald-500 hover:bg-emerald-600 text-white",
  writing: "bg-violet-500 hover:bg-violet-600 text-white",
  book: "bg-amber-500 hover:bg-amber-600 text-white",
  outgoing_link: "bg-blue-500 hover:bg-blue-600 text-white"
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
      {[...Array(10 - Math.ceil(rating))].map((_, i) => (
        <Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />
      ))}
      <span className="ml-2 text-sm text-gray-600">{rating.toFixed(1)}/10</span>
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
        const [projects, writings, books, outgoingLinks] = await Promise.all([
          fetchProjects(),
          fetchWritings(),
          fetchBooks(),
          fetchOutgoingLinks()
        ])
        
        const allEntries: ContentItem[] = [...projects, ...writings, ...books, ...outgoingLinks]
          .map(entry => ({
            ...entry,
            date: new Date(entry.date)
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
    if (entry.type === 'outgoing_link') {
      window.open(entry.url, '_blank')
    } else {
      setExpandedEntry(entry)
      window.history.pushState(null, '', `/${entry.type}/${entry.slug}`)
    }
  }

  const handleShareClick = (entry: ContentItem) => {
    const url = entry.type === 'outgoing_link' ? entry.url : `${window.location.origin}/${entry.type}/${entry.slug}`
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
      case 'outgoing_link':
        return <ExternalLink className="w-4 h-4" />
    }
  }

  const currentIndex = expandedEntry ? filteredEntries.findIndex(entry => entry.slug === expandedEntry.slug) : -1

  const navigateTimeline = (direction: 'prev' | 'next') => {
    if (currentIndex === -1) return
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1
    if (newIndex >= 0 && newIndex < filteredEntries.length) {
      setExpandedEntry(filteredEntries[newIndex])
      window.history.pushState(null, '', `/${filteredEntries[newIndex].type}/${filteredEntries[newIndex].slug}`)
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
                  {['project', 'writing', 'book', 'outgoing_link'].map((category) => (
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
                        {category === 'outgoing_link' ? 'External' : category.charAt(0).toUpperCase() + category.slice(1)}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base">Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
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
              <div className="absolute left-8 md:left-32 top-0 h-full w-px bg-border" />
              <div className="space-y-8 md:space-y-12">
                {filteredEntries.map((entry, index) => (
                  <motion.div
                    key={entry.slug}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                    className="relative pl-16 md:pl-44"
                  >
                    <time className="absolute left-0 top-0 text-base md:text-xl font-bold text-muted-foreground">
                      {formatDate(entry.date)}
                    </time>
                    <div className="absolute left-[30px] md:left-[126px] top-[10px] h-3 w-3 rounded-full border-2 border-primary bg-background" />
                    <Card className="overflow-hidden">
                      <CardContent className="p-3 md:p-4">
                        <div className="flex items-center gap-2 mb-2">
                          {getEntryIcon(entry.type)}
                          <span className={`text-xs md:text-sm font-medium capitalize ${
                            categoryColors[entry.type].split(' ')[2]
                          }`}>
                            {entry.type === 'outgoing_link' ? 'External' : entry.type}
                          </span>
                        </div>
                        <h2 className="text-lg md:text-xl font-semibold text-blue-500 hover:text-blue-600 transition-colors">
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
                          <div className="relative w-full h-32 md:h-48 my-3 md:my-4">
                            <Image
                              src={extractImageUrl(entry.image) || entry.image}
                              alt={entry.title}
                              fill
                              className="object-cover rounded-lg"
                            />
                          </div>
                        )}
                        <p className="text-sm md:text-base text-muted-foreground mt-2">
                          {entry.description}
                        </p>
                        <ScrollArea className="w-full whitespace-nowrap mt-3 md:mt-4">
                          <div className="flex gap-2">
                            {entry.tags?.map((tag, tagIndex) => (
                              <Badge 
                                key={tagIndex} 
                                className="bg-gray-50 text-gray-700 shrink-0 text-xs md:text-sm"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </ScrollArea>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-3 md:mt-4 text-xs md:text-sm"
                          onClick={() => handleShareClick(entry)}
                        >
                          <Share2 className="mr-2 h-3 w-3 md:h-4 md:w-4" />
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

      <div className="fixed bottom-6 right-6 flex gap-4">
        <Button 
          variant="ghost"
          className="p-2" 
          onClick={() => navigateTimeline('prev')} 
          disabled={currentIndex <= 0}
        >
          <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
        </Button>
        <Button 
          variant="ghost"
          className="p-2"
          onClick={() => navigateTimeline('next')} 
          disabled={currentIndex >= filteredEntries.length - 1}
        >
          <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
        </Button>
      </div>

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
              className="relative z-10 mx-auto max-w-4xl p-4 md:p-6 bg-background rounded-lg shadow-lg mt-16 mb-16 md:mt-20 md:mb-20"
            >
              <Button
                variant="ghost"
                className="mb-4 md:mb-6"
                onClick={() => {
                  setExpandedEntry(null)
                  window.history.pushState(null, '', '/')
                }}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Timeline
              </Button>
              <div className="space-y-6 md:space-y-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="space-y-3 md:space-y-4"
                >
                  <div className="flex items-center gap-2">
                    {getEntryIcon(expandedEntry.type)}
                    <span className="text-sm font-medium capitalize">{expandedEntry.type}</span>
                  </div>
                  <time className="text-sm text-muted-foreground">{formatDate(expandedEntry.date)}</time>
                  <h1 className="text-2xl md:text-4xl font-bold">{expandedEntry.title}</h1>
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
                  className="prose prose-sm md:prose-base prose-neutral dark:prose-invert max-w-none"
                >
                  <ReactMarkdown
                    components={{
                      img: ({ ...props }) => {
                        const src = props.src?.startsWith('/') 
                          ? props.src 
                          : props.src?.startsWith('http') 
                            ? props.src 
                            : `/images/${props.src}`
                        return (
                          <div className="flex justify-between items-start gap-8">
                            <img
                              src={src}
                              alt={props.alt || ''}
                              className="w-full rounded-lg my-4 md:my-5"
                            />
                          </div>
                        )
                      },
                      video: ({ src, ...props }) => (
                        <video
                          src={src}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full rounded-lg shadow-md my-4 md:my-5"
                          style={{
                            borderRadius: "8px",
                          }}
                          {...props}
                        />
                      ),
                      h2: ({ ...props }) => (
                        <h2 className="text-xl md:text-2xl font-semibold mt-6 md:mt-8 mb-3 md:mb-4" {...props} />
                      ),
                      h3: ({ ...props }) => (
                        <h3 className="text-lg md:text-xl font-semibold mt-5 md:mt-6 mb-2 md:mb-3" {...props} />
                      ),
                      p: ({ ...props }) => (
                        <p className="mb-3 md:mb-4 leading-relaxed" {...props} />
                      ),
                      ul: ({ ...props }) => (
                        <ul className="list-disc pl-5 md:pl-6 mb-3 md:mb-4" {...props} />
                      ),
                      ol: ({ ...props }) => (
                        <ol className="list-decimal pl-5 md:pl-6 mb-3 md:mb-4" {...props} />
                      ),
                      li: ({ ...props }) => (
                        <li className="mb-1 md:mb-2" {...props} />
                      ),
                      code: ({ className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '')
                        return match ? (
                          <pre className="bg-muted p-3 md:p-4 rounded-lg overflow-x-auto">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        ) : (
                          <code className="bg-muted px-1 py-0.5 rounded text-sm md:text-base" {...props}>
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