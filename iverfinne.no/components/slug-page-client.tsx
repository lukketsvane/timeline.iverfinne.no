'use client'

import { MDXRemote } from 'next-mdx-remote'
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar } from 'lucide-react'
import Link from 'next/link'
import { getTagColor } from "@/lib/tag-utils"
import { cn } from "@/lib/utils"
import { HtmlIframe } from "@/components/html-iframe"
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { fullPageMdxComponents } from '@/lib/mdx-components'
import WebDesignKeys from '@/components/WebDesignKeys'
import { AudioPlayer } from '@/components/audio-player'

const components = {
  ...fullPageMdxComponents,
  WebDesignKeys,
}

interface SlugPageClientProps {
  post: any
}

export default function SlugPageClient({ post }: SlugPageClientProps) {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)

  useEffect(() => {
    if (!enlargedImage) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEnlargedImage(null) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [enlargedImage])

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
    <>
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

        {post.lyd && (
          <div className="mb-6">
            <AudioPlayer src={post.lyd} title={post.title} />
          </div>
        )}

        {post.type === "Bilete" && post.thumbnails && (
          <div className="mb-12 flex flex-col gap-4">
            {post.thumbnails.map((img: { src: string; alt: string }, i: number) => (
              <img
                key={i}
                src={img.src}
                alt={img.alt}
                className="max-w-full h-auto rounded-lg cursor-pointer hover:brightness-95 transition-[filter] duration-150"
                onClick={() => setEnlargedImage(img.src)}
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

      <AnimatePresence>
        {enlargedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer"
            style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
            onClick={() => setEnlargedImage(null)}
          >
            <div className="absolute inset-0 bg-white/80 dark:bg-black/80" />
            <motion.img
              src={enlargedImage}
              alt=""
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative z-10 max-w-[92vw] max-h-[90vh] object-contain rounded-lg select-none"
              draggable={false}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
