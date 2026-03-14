'use client'

import { useState, useEffect, useMemo } from "react"
import { Search } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { motion } from 'framer-motion'
import { cn } from "@/lib/utils"
import { MDXCard } from "./mdx-card"
import type { MDXRemoteSerializeResult } from 'next-mdx-remote'
import { getTagColor } from "@/lib/tag-utils"
import { useRouter } from "next/navigation"

interface Post {
  uid: string
  id?: string
  title: string
  description: string
  date: string
  tags: string[] | string | undefined
  slug: string
  type: "Skriving" | "Bok" | "Prosjekt" | "Lenkje" | "Interaktiv" | "Bilete"
  image?: string
  coverimage?: string
  content: string
  serialized?: MDXRemoteSerializeResult
  url?: string
  icon?: string
  thumbnails?: { src: string; alt: string }[]
}

const contentTypes = [
  { label: "Skriving", value: "Skriving" },
  { label: "Bok", value: "Bok" },
  { label: "Prosjekt", value: "Prosjekt" },
  { label: "Lenkje", value: "Lenkje" },
  { label: "Interaktiv", value: "Interaktiv" },
  { label: "Bilete", value: "Bilete" },
]

interface FilterButtonProps {
  label: string
  isActive: boolean
  onClick: () => void
  variant?: "type" | "tag" | "default"
}

const typeColorMap: Record<string, { active: string; inactive: string }> = {
  Skriving: { active: "bg-blue-500 text-white border-blue-500", inactive: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  Bok: { active: "bg-green-500 text-white border-green-500", inactive: "bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800" },
  Prosjekt: { active: "bg-purple-500 text-white border-purple-500", inactive: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800" },
  Lenkje: { active: "bg-orange-500 text-white border-orange-500", inactive: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800" },
  Interaktiv: { active: "bg-pink-500 text-white border-pink-500", inactive: "bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-950 dark:text-pink-400 dark:border-pink-800" },
  Bilete: { active: "bg-teal-500 text-white border-teal-500", inactive: "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800" },
}

const FilterButton = ({ label, isActive, onClick, variant = "default" }: FilterButtonProps) => {
  const color = getTagColor(label)

  const baseStyles = "text-xs px-3 py-1 h-auto font-normal transition-all"
  const typeColor = typeColorMap[label]
  const variantStyles = {
    type: cn(
      "rounded-full border",
      typeColor
        ? (isActive ? typeColor.active : typeColor.inactive)
        : (isActive ? color : "bg-white dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-800 hover:border-gray-300")
    ),
    tag: cn(
      "rounded-sm border",
      isActive
        ? color
        : "bg-white dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-800 hover:border-gray-300"
    ),
    default: "bg-gray-100/50 hover:bg-gray-200/50 text-gray-600 rounded-full"
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        baseStyles,
        variantStyles[variant]
      )}
    >
      {label}
    </Button>
  )
}

interface MDXBlogProps {
  initialPosts?: Post[]
  initialType?: string
}

export default function MDXBlog({ initialPosts = [], initialType }: MDXBlogProps) {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [search, setSearch] = useState("")
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    initialType ? [contentTypes.find(t => t.value.toLowerCase() === initialType.toLowerCase())?.value || ""].filter(Boolean) : []
  )
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const uniqueTags = useMemo(() => {
    const tagSet = new Set<string>()
    posts.forEach(post => {
      if (Array.isArray(post.tags)) {
        post.tags.forEach(tag => tagSet.add(tag.toLowerCase()))
      }
    })
    return Array.from(tagSet).sort()
  }, [posts])

  useEffect(() => {
    setPosts(initialPosts)
  }, [initialPosts])

  // Update selected types if initialType changes (via route navigation)
  useEffect(() => {
    if (initialType) {
      const typeLabel = contentTypes.find(t => t.value.toLowerCase() === initialType.toLowerCase())?.value
      if (typeLabel) {
        setSelectedTypes([typeLabel])
      }
    } else {
      setSelectedTypes([])
    }
  }, [initialType])

  const filteredPosts = useMemo(() => {
    // Fuzzy match: checks if all characters of query appear in order in target
    const fuzzyMatch = (target: string, query: string): number => {
      if (!target || !query) return 0
      const t = target.toLowerCase()
      const q = query.toLowerCase()
      if (t.includes(q)) return 1.0 // exact substring = perfect
      // Check character-by-character fuzzy match
      let ti = 0, qi = 0, matched = 0
      while (ti < t.length && qi < q.length) {
        if (t[ti] === q[qi]) { matched++; qi++ }
        ti++
      }
      if (qi < q.length) return 0 // didn't match all query chars
      return matched / Math.max(t.length, q.length) * 0.7 // partial score
    }

    // Synonyms for type names (Norwegian ↔ English)
    const typeSynonyms: Record<string, string[]> = {
      skriving: ['writing', 'artikkel', 'article', 'essay', 'tekst', 'text'],
      bok: ['book', 'books', 'reading', 'lesing', 'review', 'bokmelding'],
      prosjekt: ['project', 'projects', 'work', 'arbeid'],
      lenkje: ['link', 'links', 'lenke', 'url', 'nettside', 'website'],
      interaktiv: ['interactive', 'app', 'demo', 'visualisering', 'visualization'],
      bilete: ['image', 'images', 'photo', 'photos', 'bilder', 'bilde', 'gallery', 'galleri'],
    }

    const scorePost = (post: Post, query: string): number => {
      if (!query) return 1
      const q = query.toLowerCase().trim()
      const terms = q.split(/\s+/)
      let totalScore = 0

      for (const term of terms) {
        let best = 0

        // Title (highest weight)
        best = Math.max(best, fuzzyMatch(post.title, term) * 10)

        // Tags
        if (Array.isArray(post.tags)) {
          for (const tag of post.tags) {
            best = Math.max(best, fuzzyMatch(tag, term) * 7)
          }
        }

        // Type name + synonyms
        best = Math.max(best, fuzzyMatch(post.type, term) * 6)
        const syns = typeSynonyms[post.type.toLowerCase()] || []
        for (const syn of syns) {
          best = Math.max(best, fuzzyMatch(syn, term) * 5)
        }

        // Description
        best = Math.max(best, fuzzyMatch(post.description, term) * 4)

        // Slug
        best = Math.max(best, fuzzyMatch(post.slug, term) * 3)

        // Content (lower weight, just check inclusion for perf)
        if (post.content?.toLowerCase().includes(term)) {
          best = Math.max(best, 2)
        }

        // Date (year/month)
        if (post.date?.includes(term)) {
          best = Math.max(best, 3)
        }

        totalScore += best
      }

      return totalScore / terms.length
    }

    try {
      const scored = posts
        .map(post => {
          const matchesTypes = selectedTypes.length === 0 || selectedTypes.includes(post.type)
          const matchesTags = selectedTags.length === 0 ||
            (Array.isArray(post.tags) && post.tags.some(tag =>
              selectedTags.includes(tag.toLowerCase())
            ))
          if (!matchesTypes || !matchesTags) return null
          const score = scorePost(post, search)
          if (search && score < 1) return null
          return { post, score }
        })
        .filter((x): x is { post: Post; score: number } => x !== null)

      // If searching, sort by relevance; otherwise keep date order
      if (search) {
        scored.sort((a, b) => b.score - a.score)
      }

      return scored.map(x => x.post)
      })
    } catch (err) {
      console.error('Error filtering posts:', err)
      return []
    }
  }, [posts, search, selectedTypes, selectedTags])

  const handlePostToggle = async (uid: string) => {
    try {
      setExpandedPosts(prev => {
        const next = new Set(prev)
        if (next.has(uid)) {
          next.delete(uid)
          return next
        } 
        return next.add(uid)
      })

      const postIndex = posts.findIndex(p => p.uid === uid)
      if (postIndex === -1) return

      const post = posts[postIndex]
      if (!post.serialized && post.id) {
          try {
            const res = await fetch(`/api/posts/${post.id}`)
            if (res.ok) {
                const data = await res.json()
                if (data.source) {
                    setPosts(prev => {
                        const newPosts = [...prev]
                        newPosts[postIndex] = { ...post, serialized: data.source }
                        return newPosts
                    })
                }
            }
          } catch (e) {
            console.error("Failed to fetch post content", e)
          }
      }

    } catch (err) {
      console.error('Error toggling post:', err)
      setError('Feila ved utviding av innlegg')
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 max-w-screen overflow-hidden">
      <aside className="w-full lg:w-48 space-y-4 shrink-0">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {contentTypes.map((type) => (
              <FilterButton
                key={type.value}
                label={type.label}
                isActive={selectedTypes.includes(type.value)}
                onClick={() => {
                  const isSelected = selectedTypes.includes(type.value)
                  const newTypes = isSelected
                    ? selectedTypes.filter((t) => t !== type.value)
                    : [...selectedTypes, type.value]
                  
                  setSelectedTypes(newTypes)
                  
                  // Naviger til ny rute viss nøyaktig éin type er vald
                  if (newTypes.length === 1) {
                    router.push(`/${newTypes[0].toLowerCase()}`)
                  } else if (newTypes.length === 0) {
                    router.push('/')
                  }
                }}
                variant="type"
              />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {uniqueTags.slice(0, 5).map((tag) => (
              <FilterButton
                key={tag}
                label={tag}
                isActive={selectedTags.includes(tag)}
                onClick={() => {
                  setSelectedTags((prev) =>
                    prev.includes(tag)
                      ? prev.filter((t) => t !== tag)
                      : [...prev, tag]
                  )
                }}
                variant="tag"
              />
            ))}
          </div>
        </div>
      </aside>
      <main className="flex-1 space-y-4 min-w-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Leit i arkivet..."
            className="pl-10 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <motion.div 
          className="relative mt-4"
          layout
          transition={{ duration: 0.2, ease: "linear" }}
        >
          {filteredPosts.length > 0 ? (
            filteredPosts.map((post, index) => {
              const currentYear = new Date(post.date).getFullYear()
              const prevYear = index > 0 ? new Date(filteredPosts[index - 1].date).getFullYear() : null
              const showYear = currentYear !== prevYear

              return (
                <div key={post.uid}>
                  {showYear && (
                    <div className="relative grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-4 mb-4">
                      <div className="hidden sm:block w-24 shrink-0" />
                      <div className="relative">
                        <div className="absolute left-0 w-0.5 top-0 bottom-0 bg-gray-200 dark:bg-gray-700 -translate-x-1/2" />
                        <div className="py-4">
                          <span className="bg-white dark:bg-gray-900 px-3 py-1 text-sm font-bold text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full relative z-10 -translate-x-1/2 inline-block">
                            {currentYear}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <MDXCard
                    post={post}
                    isExpanded={expandedPosts.has(post.uid)}
                    onToggle={() => handlePostToggle(post.uid)}
                    serializedContent={post.serialized || null}
                  />
                </div>
              )
            })
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {error ? 'Feil ved lasting av innlegg' : 'Fann ingen innlegg som passar søket.'}
            </p>
          )}
        </motion.div>
      </main>
    </div>
  )
}
