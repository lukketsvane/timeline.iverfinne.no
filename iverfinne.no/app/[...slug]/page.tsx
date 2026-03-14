'use client'

import { VALID_TYPES } from '@/lib/notion'
import { notFound } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote'
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar } from 'lucide-react'
import Link from 'next/link'
import { getTagColor } from "@/lib/tag-utils"
import { cn } from "@/lib/utils"
import { HtmlIframe } from "@/components/html-iframe"
import NextImage from "next/image"
import { motion } from 'framer-motion'
import { useEffect, useState, use } from 'react'
import MDXBlog from '@/components/mdx-blog'
import { usePosts } from '@/lib/posts-context'
import { fullPageMdxComponents } from '@/lib/mdx-components'
import WebDesignKeys from '@/components/WebDesignKeys'

const components = {
  ...fullPageMdxComponents,
  WebDesignKeys,
}

export default function DynamicPage({ params: paramsPromise }: { params: Promise<{ slug: string[] }> }) {
  const params = use(paramsPromise)
  const router = useRouter()
  const segments = params.slug
  const { posts: contextPosts, getPostByTypeAndSlug, getPostBySlug } = usePosts()
  const [post, setPost] = useState<any>(null)
  const [allPosts, setAllPosts] = useState<any[]>([])
  const [pageMode, setPageMode] = useState<'loading' | 'type-filter' | 'post' | 'not-found'>('loading')

  useEffect(() => {
    // Try context first (instant when navigating from homepage)
    if (segments.length === 1) {
      const slugLower = segments[0].toLowerCase()

      if (VALID_TYPES.includes(slugLower)) {
        if (contextPosts.length > 0) {
          setAllPosts(contextPosts)
          setPageMode('type-filter')
          return
        }
        // Fallback: fetch from API
        fetch('/api/posts?content=1').then(r => r.json()).then(data => {
          setAllPosts(data)
          setPageMode('type-filter')
        }).catch(() => setPageMode('not-found'))
        return
      }

      // Old slug-only URL — redirect
      const found = contextPosts.length > 0
        ? getPostBySlug(segments[0])
        : null

      if (found) {
        router.replace(`/${found.type.toLowerCase()}/${found.slug}`)
        return
      }

      if (contextPosts.length === 0) {
        fetch('/api/posts').then(r => r.json()).then(data => {
          const f = data.find((p: any) => p.slug === segments[0])
          if (f) {
            router.replace(`/${f.type.toLowerCase()}/${f.slug}`)
          } else {
            setPageMode('not-found')
          }
        }).catch(() => setPageMode('not-found'))
        return
      }

      setPageMode('not-found')
      return
    }

    if (segments.length === 2) {
      const [typeSeg, slugSeg] = segments

      if (!VALID_TYPES.includes(typeSeg.toLowerCase())) {
        setPageMode('not-found')
        return
      }

      // Try context first (instant)
      if (contextPosts.length > 0) {
        const found = getPostByTypeAndSlug(typeSeg, slugSeg)
        if (found) {
          setPost(found)
          setPageMode('post')
          return
        }
        setPageMode('not-found')
        return
      }

      // Fallback: fetch from API (direct URL access)
      fetch('/api/posts?content=1').then(r => r.json()).then(data => {
        const found = data.find((p: any) => p.slug === slugSeg && p.type.toLowerCase() === typeSeg.toLowerCase())
        if (found) {
          setPost(found)
          setPageMode('post')
        } else {
          setPageMode('not-found')
        }
      }).catch(() => setPageMode('not-found'))
      return
    }

    setPageMode('not-found')
  }, [segments, contextPosts, getPostByTypeAndSlug, getPostBySlug, router])

  if (pageMode === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">.</div>
  }

  if (pageMode === 'not-found') {
    notFound()
  }

  if (pageMode === 'type-filter') {
    const displayType = segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-8 overflow-x-hidden">
        <MDXBlog initialPosts={allPosts} initialType={displayType} />
      </div>
    )
  }

  if (!post) notFound()

  if (post.type === "Interaktiv") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="w-full h-screen"
      >
        <HtmlIframe content={post.content || ""} fullScreen={true} />
      </motion.div>
    )
  }

  const dateObj = new Date(post.date)
  const day = dateObj.getDate()
  const monthsFull = [
    "januar", "februar", "mars", "april", "mai", "juni",
    "juli", "august", "september", "oktober", "november", "desember"
  ]
  const monthsShort = [
    "jan.", "feb.", "mars", "apr.", "mai", "juni",
    "juli", "aug.", "sep.", "okt.", "nov.", "des."
  ]
  const monthName = monthsFull[dateObj.getMonth()]
  const month = monthName.length > 4 ? monthsShort[dateObj.getMonth()] : monthName
  const year = dateObj.getFullYear()

  return (
    <motion.article
      layoutId={`post-${post.uid}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="max-w-4xl mx-auto px-4 py-12 min-h-screen"
    >
      <Link
        href="/"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Tilbake til forsida
      </Link>

      <header className="mb-12">
        <div className="mb-8">
          {post.type !== "Bilete" && (
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05, duration: 0.3 }}
              className="text-4xl sm:text-5xl font-bold tracking-tight"
            >
              {post.title}
            </motion.h1>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-6 text-muted-foreground">
          <div className="flex items-center gap-2 text-muted-foreground lowercase">
            <Calendar className="w-4 h-4" />
            <time dateTime={post.date}>
              <span className="font-extrabold">{day}.</span> {month} {year}
            </time>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className={cn("capitalize rounded-full border", getTagColor(post.type))}
            >
              {post.type}
            </Badge>
          </div>

          {Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {post.tags.map((tag: string) => (
                <Badge
                  key={tag}
                  className={cn("text-xs rounded-sm border", getTagColor(tag))}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </header>

      {post.type === "Bilete" && post.thumbnails && (
        <div className="mb-12 flex flex-col gap-4">
          {post.thumbnails.map((img: { src: string; alt: string }, i: number) => (
            <img
              key={i}
              src={img.src}
              alt={img.alt}
              className="max-w-full h-auto rounded-lg"
            />
          ))}
        </div>
      )}

      <div className="prose prose-lg dark:prose-invert max-w-none">
        {post.serialized && (
          <MDXRemote
            {...post.serialized}
            components={{
              ...components,
              ...(post.type === "Bok" && (post.image || post.icon) ? {
                img: (props: any) => {
                  if (props.src === post.image || props.src === post.icon) return null
                  return <img {...props} className="max-w-full h-auto rounded-lg my-6" />
                }
              } : {})
            }}
          />
        )}
      </div>
    </motion.article>
  )
}
