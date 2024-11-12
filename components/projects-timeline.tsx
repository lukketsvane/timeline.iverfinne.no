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
import { Toast, ToastTitle, ToastDescription } from "@/components/ui/toast"
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'
import { fetchProjects, fetchWritings, fetchBooks, Outgoing, ContentItem } from "@/lib/github"
import { ErrorBoundary } from 'react-error-boundary'

const categoryColors = {
  project: "bg-blue-500 text-white",
  writing: "bg-green-500 text-white",
  book: "text-purple-500",
  outgoing: "bg-orange-500 text-white"
} as const

const selectedCategoryColors = {
  project: "bg-blue-700 text-white",
  writing: "bg-green-700 text-white",
  book: "text-purple-700",
  outgoing: "bg-orange-700 text-white"
} as const

const Rating: React.FC<{ rating: number }> = React.memo(({ rating }) => {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5

  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${rating} out of 10`}>
      {[...Array(fullStars)].map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-primary text-primary" aria-hidden="true" />
      ))}
      {hasHalfStar && <Star className="w-4 h-4 fill-primary text-primary" aria-hidden="true" />}
      {[...Array(10 - Math.ceil(rating))].map((_, i) => (
        <Star key={`empty-${i}`} className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      ))}
      <span className="ml-2 text-sm text-muted-foreground">{rating.toFixed(1)}/10</span>
    </div>
  )
})

Rating.displayName = 'Rating'

const EntryIcon: React.FC<{ type: ContentItem['type'] }> = React.memo(({ type }) => {
  switch (type) {
    case 'project':
      return <Code className="w-4 h-4" aria-hidden="true" />
    case 'writing':
      return <Pen className="w-4 h-4" aria-hidden="true" />
    case 'book':
      return <Book className="w-4 h-4" aria-hidden="true" />
    case 'outgoing':
      return <ExternalLink className="w-4 h-4" aria-hidden="true" />
  }
})

EntryIcon.displayName = 'EntryIcon'

const LazyImage: React.FC<{ src: string; alt: string; width: number; height: number }> = React.memo(({ src, alt, width, height }) => {
  const [isLoaded, setIsLoaded] = React.useState(false)

  return (
    <div className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="object-cover rounded-sm"
        onLoad={() => setIsLoaded(true)}
        loading="lazy"
      />
    </div>
  )
})

LazyImage.displayName = 'LazyImage'

function ErrorFallback({error, resetErrorBoundary}: {error: Error, resetErrorBoundary: () => void}) {
  return (
    <div role="alert" className="p-4 bg-red-100 text-red-700 rounded-md">
      <p className="font-bold">Something went wrong:</p>
      <pre className="mt-2 text-sm">{error.message}</pre>
      <button onClick={resetErrorBoundary} className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
        Try again
      </button>
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
  const [showToast, setShowToast] = React.useState(false)

  const loadEntries = React.useCallback(async () => {
    try {
      const [projects, writings, books, outgoingLinks] = await Promise.all([
        fetchProjects(),
        fetchWritings(),
        fetchBooks(),
        Outgoing()
      ])
      
      const allEntries: ContentItem[] = [...projects, ...writings, ...books, ...outgoingLinks]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setEntries(allEntries)
      setIsLoading(false)
    } catch (error) {
      console.error('Error fetching entries:', error)
      setError('Failed to load content. Please try again later.')
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadEntries()
  }, [loadEntries])

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

  const toggleFilter = React.useCallback((filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    )
  }, [])

  const toggleCategory = React.useCallback((category: string) => {
    setActiveCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }, [])

  const displayedTags = React.useMemo(() => {
    return showAllTags ? allTags : allTags.slice(0, 10)
  }, [allTags, showAllTags])

  const handleEntryClick = React.useCallback((entry: ContentItem) => {
    if (entry.type === 'outgoing') {
      window.open(entry.url, '_blank', 'noopener,noreferrer')
    } else {
      setExpandedEntry(entry)
      window.history.pushState(null, '', `/${entry.type}/${entry.slug}`)
    }
  }, [])

  const handleShareClick = React.useCallback((entry: ContentItem) => {
    const url = entry.type === 'outgoing' && entry.url 
      ? entry.url 
      : `${window.location.origin}/${entry.type}/${entry.slug}`
    
    navigator.clipboard.writeText(url).then(() => {
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    }).catch(err => {
      console.error('Failed to copy link: ', err)
    })
  }, [])

  const formatDate = React.useCallback((date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  }, [])

  const currentIndex = expandedEntry ? filteredEntries.findIndex(entry => entry.slug === expandedEntry.slug) : -1

  const navigateTimeline = React.useCallback((direction: 'prev' | 'next') => {
    if (currentIndex === -1) return
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1
    if (newIndex >= 0 && newIndex < filteredEntries.length) {
      setExpandedEntry(filteredEntries[newIndex])
      window.history.pushState(null, '', `/${filteredEntries[newIndex].type}/${filteredEntries[newIndex].slug}`)
    }
  }, [currentIndex, filteredEntries])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen" aria-live="polite" aria-busy="true">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-destructive" role="alert">
        {error}
      </div>
    )
  }

  return (
    <div className="bg-background">
      <div className="container mx-auto p-4 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[250px,1fr]">
          <aside className="space-y-6 w-full lg:w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                placeholder="Type here to search"
                className="pl-10 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search entries"
              />
            </div>
            <div className="space-y-4 w-full">
              <div className="w-full">
                <Label className="text-base">Categories</Label>
                <div className="flex flex-wrap gap-2 mt-2 w-full">
                  {['project', 'writing', 'book', 'outgoing'].map((category) => (
                    <Badge
                      key={category}
                      className={`cursor-pointer transition-colors ${
                        activeCategories.includes(category)
                          ? selectedCategoryColors[category as keyof typeof selectedCategoryColors]
                          : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                      }`}
                      onClick={() => toggleCategory(category)}
                      role="checkbox"
                      aria-checked={activeCategories.includes(category)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleCategory(category)
                        }
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        <EntryIcon type={category as ContentItem['type']} />
                        {category === 'outgoing' ? 'External' : category.charAt(0).toUpperCase() + category.slice(1)}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="w-full">
                <Label className="text-base">Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2 w-full">
                  {displayedTags.map(tag => (
                    <Badge
                      key={tag}
                      className={`cursor-pointer transition-colors ${
                        activeFilters.includes(tag)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                      onClick={() => toggleFilter(tag)}
                      role="checkbox"
                      aria-checked={activeFilters.includes(tag)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleFilter(tag)
                        }
                      }}
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
                    aria-expanded={showAllTags}
                  >
                    {showAllTags ? (
                      <>Show Less <ChevronUp className="ml-1 h-4 w-4" aria-hidden="true" /></>
                    ) : (
                      <>Show More <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" /></>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </aside>
          <div className="w-full h-px bg-border lg:hidden" aria-hidden="true" />
          <main>
            <ErrorBoundary
              FallbackComponent={ErrorFallback}
              onReset={() => {
                loadEntries()
              }}
            >
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-border" aria-hidden="true" />
                <div className="space-y-8 md:space-y-12">
                  {filteredEntries.map((entry, index) => (
                    <motion.div
                      key={entry.slug}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.3 }}
                      className="relative pl-8 md:pl-10"
                    >
                      <div 
                        className={`absolute left-[-6px] top-0 h-3 w-3 rounded-full border-2 ${
                          entry.type === 'book' 
                            ? 'border-purple-500 bg-background' 
                            : `border-background ${categoryColors[entry.type].split(' ')[0]}`
                        }`} 
                        aria-hidden="true" 
                      />
                      <time className="block mb-2 text-sm md:text-base font-medium text-muted-foreground">
                        {formatDate(entry.date)}
                      </time>
                      <Card className="overflow-hidden">
                        <CardContent className="p-4 md:p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <EntryIcon type={entry.type} />
                            <span className={`text-xs md:text-sm font-medium capitalize ${
                              categoryColors[entry.type]
                            }`}>
                              {entry.type === 'outgoing' ? 'External' : entry.type}
                            </span>
                          </div>
                          <div className="flex items-start gap-4">
                            {entry.type === 'book' && entry.image && (
                              <div className="flex-shrink-0">
                                <LazyImage
                                  src={entry.image}
                                  alt={entry.title}
                                  width={60}
                                  height={90}
                                />
                              </div>
                            )}
                            <div className="flex-grow">
                              {entry.type === 'outgoing' ? (
                                <a
                                  href={entry.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-lg md:text-xl font-semibold text-primary hover:underline"
                                >
                                  {entry.title}
                                </a>
                              ) : (
                                <h2 className="text-lg md:text-xl font-semibold text-primary hover:underline">
                                  <button className="text-left" onClick={() => handleEntryClick(entry)}>
                                    {entry.title}
                                  </button>
                                </h2>
                              )}
                              {entry.type === 'book' && entry.rating !== undefined && (
                                <div className="mt-2">
                                  <Rating rating={entry.rating} />
                                </div>
                              )}
                              <p className="text-sm md:text-base text-muted-foreground mt-2">
                                {entry.description}
                              </p>
                            </div>
                          </div>
                          <ScrollArea className="w-full whitespace-nowrap mt-3 md:mt-4">
                            <div className="flex gap-2">
                              {entry.tags?.map((tag, tagIndex) => (
                                <Badge 
                                  key={tagIndex} 
                                  className="bg-secondary text-secondary-foreground shrink-0 text-xs md:text-sm"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </ScrollArea>
                          {entry.type !== 'outgoing' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-3 md:mt-4 text-xs md:text-sm"
                              onClick={() => handleShareClick(entry)}
                            >
                              <Share2 className="mr-2 h-3 w-3 md:h-4 md:w-4" aria-hidden="true" />
                              Share
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            </ErrorBoundary>
          </main>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 flex gap-4">
        <Button 
          variant="ghost"
          className="p-2" 
          onClick={() => navigateTimeline('prev')} 
          disabled={currentIndex <= 0}
          aria-label="Previous entry"
        >
          <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" aria-hidden="true" />
        </Button>
        <Button 
          variant="ghost"
          className="p-2"
          onClick={() => navigateTimeline('next')} 
          disabled={currentIndex >= filteredEntries.length - 1}
          aria-label="Next entry"
        >
          <ChevronRight className="h-6 w-6 md:h-8 md:w-8" aria-hidden="true" />
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
                <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
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
                    <EntryIcon type={expandedEntry.type} />
                    <span className={`text-sm font-medium capitalize ${categoryColors[expandedEntry.type]}`}>
                      {expandedEntry.type}
                    </span>
                  </div>
                  <time className="text-sm text-muted-foreground">{formatDate(expandedEntry.date)}</time>
                  <h1 className="text-2xl md:text-4xl font-bold">{expandedEntry.title}</h1>
                  {expandedEntry.type === 'book' && expandedEntry.rating !== undefined && (
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
                            <LazyImage
                              src={src}
                              alt={props.alt || ''}
                              width={800}
                              height={600}
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

      <AnimatePresence>
        {showToast && (
          <Toast>
            <ToastTitle>Link copied</ToastTitle>
            <ToastDescription>
              The link has been copied to your clipboard.
            </ToastDescription>
          </Toast>
        )}
      </AnimatePresence>
    </div>
  )
}