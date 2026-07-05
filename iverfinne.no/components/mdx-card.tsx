'use client'

import { useState, useMemo, useEffect } from "react"
import NextImage from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MDXRemote } from 'next-mdx-remote'
import type { MDXRemoteSerializeResult } from 'next-mdx-remote'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, notionImgSrc, notionImgSrcSet } from "@/lib/utils"
import { ImageGallery } from "@/components/image-gallery"
import { 
  Link2, 
  Minus, 
  Plus, 
  Trash2, 
  X, 
  Check, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ExternalLink,
  Github, 
  Twitter, 
  Mail, 
  Globe, 
  Calendar, 
  Clock, 
  User, 
  Tag, 
  Search, 
  Menu, 
  ArrowRight, 
  ArrowLeft,
  Settings,
  Info,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  Download,
  Share2,
  Heart,
  Star,
  Home
} from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getTagColor } from "@/lib/tag-utils"
import { HtmlIframe } from "@/components/html-iframe"
import { ModelViewer } from "@/components/model-viewer"
import { AudioPlayer } from "@/components/audio-player"
import { ProgressiveImage } from "@/components/progressive-image"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { baseMdxComponents } from "@/lib/mdx-components"

const WebDesignKeys = dynamic(() => import('@/components/WebDesignKeys'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center"></div>
})

const mdxComponents = {
  ...baseMdxComponents,
  // UI Components for interactive MDX posts
  Button, Textarea, Input, Badge,
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  // Icons available in MDX content
  Minus, Plus, Trash2, X, Check, ChevronRight, ChevronLeft, ExternalLink,
  Github, Twitter, Mail, Globe, Calendar, Clock, User, Tag, Search, Menu,
  ArrowRight, ArrowLeft, Settings, Info, AlertCircle, AlertTriangle,
  Eye, EyeOff, Copy, Download, Share2, Heart, Star, Home,
}

interface Post {
  uid: string
  title: string
  description: string
  date: string
  tags: string[] | string | undefined
  slug: string
  type: "Skriving" | "Bok" | "Prosjekt" | "Lenkje" | "Interaktiv" | "Bilete" | "Presentasjon"
  image?: string
  coverimage?: string
  content: string
  url?: string
  lyd?: string
  icon?: string
  sosialbilete?: string
  thumbnails?: { src: string; alt: string }[]
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  modelSrc?: string
  lesMeir?: boolean
}

// Category-label / timeline colour per type. Text-only tints (the badge tints
// live in tag-utils); used for the small uppercase label above each title.
const typeTextColor: Record<string, string> = {
  Skriving: "text-blue-600 dark:text-blue-400",
  Bok: "text-green-600 dark:text-green-400",
  Prosjekt: "text-purple-600 dark:text-purple-400",
  Lenkje: "text-orange-600 dark:text-orange-400",
  Interaktiv: "text-pink-600 dark:text-pink-400",
  Bilete: "text-teal-600 dark:text-teal-400",
  Presentasjon: "text-indigo-600 dark:text-indigo-400",
}

interface MDXCardProps {
  post: Post
  isExpanded: boolean
  onToggle: () => void
  serializedContent: MDXRemoteSerializeResult | null
}

// Route NextImage widths through the resizing proxy for /api/notion-image
// sources; external images keep the default (remotePatterns) pipeline.
const notionImageLoader = ({ src, width }: { src: string; width: number }) => `${src}&w=${width}`
const loaderFor = (src: string) =>
  src.startsWith('/api/notion-image?') ? notionImageLoader : undefined

const TimelineConnector = () => (
  <div className="absolute -left-1.5 sm:-left-2 w-0.5 top-0 bottom-0 bg-gray-200 dark:bg-gray-700 -translate-x-1/2" />
)

const TimelineNode = ({ type, onToggle, url }: { type: string, onToggle: () => void, url?: string }) => {
  const typeColors = {
    Skriving: "bg-blue-500",
    Bok: "bg-green-500",
    Prosjekt: "bg-purple-500",
    Lenkje: "bg-orange-500",
    Interaktiv: "bg-pink-500",
    Bilete: "bg-teal-500",
    Presentasjon: "bg-indigo-500"
  }
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (type === "Lenkje" && url) {
      window.open(url, '_blank')
    } else {
      onToggle()
    }
  }
  
  return (
    <button 
      onClick={handleClick}
      className={cn(
        "absolute -left-1.5 sm:-left-2 top-4 w-4 h-4 sm:w-5 sm:h-5 rounded-full -translate-x-1/2 border-2 border-white dark:border-gray-900 z-10 transition-transform hover:scale-125 cursor-pointer",
        typeColors[type as keyof typeof typeColors] || "bg-gray-500"
      )}
      aria-label={type === "Lenkje" ? "Opna lenkje" : "Utvid eller skjul innhald"}
    />
  )
}

function getFigmaEmbedUrl(content: string, url?: string): string | null {
  if (!content && !url) return null
  const all = (content || '') + ' ' + (url || '')
  // Match embed.figma.com URLs
  const embedMatch = all.match(/https:\/\/embed\.figma\.com\/[^\s"'<>]+/)
  if (embedMatch) return embedMatch[0]
  // Match figma.com/slides or figma.com/proto URLs and convert to embed
  const figmaMatch = all.match(/https:\/\/(?:www\.)?figma\.com\/(slides|proto|design)\/([^\s"'<>]+)/)
  if (figmaMatch) return `https://embed.figma.com/${figmaMatch[1]}/${figmaMatch[2]}${figmaMatch[0].includes('?') ? '&' : '?'}embed-host=share`
  return null
}

function getFirstImageFromContent(content: string): string | null {
  if (!content) return null
  const match = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)
  if (match) return match[1]
  const imgMatch = content.match(/<img[^>]+src=["'](https?:\/\/[^\s"']+)["']/)
  if (imgMatch) return imgMatch[1]
  return null
}

function estimateReadTime(content: string): number {
  if (!content) return 0
  const words = content.replace(/[#*\[\]()!<>{}]/g, '').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

type SocialLink = { type: 'github' | 'instagram' | 'linkedin' | 'twitter' | 'external'; url: string }

function extractOutgoingLinks(content: string, postUrl?: string): SocialLink[] {
  if (!content && !postUrl) return []
  const allText = (content || '') + ' ' + (postUrl || '')
  const urls = new Set<string>()
  const linkRegex = /https?:\/\/[^\s)"\]<>]+/g
  let m
  while ((m = linkRegex.exec(allText)) !== null) urls.add(m[0])

  const links: SocialLink[] = []
  const seen = new Set<string>()
  for (const url of urls) {
    let type: SocialLink['type'] = 'external'
    if (url.includes('github.com')) type = 'github'
    else if (url.includes('instagram.com')) type = 'instagram'
    else if (url.includes('linkedin.com')) type = 'linkedin'
    else if (url.includes('twitter.com') || url.includes('x.com')) type = 'twitter'
    else continue // only show recognized social links
    if (!seen.has(type)) {
      seen.add(type)
      links.push({ type, url })
    }
  }
  // Also add generic external link if post has a URL
  if (postUrl && !seen.has('external')) {
    links.unshift({ type: 'external', url: postUrl })
  }
  return links
}

export function MDXCard({ post, isExpanded, onToggle, serializedContent }: MDXCardProps) {
  const router = useRouter()
  const [enlargedImageIndex, setEnlargedImageIndex] = useState<number | null>(null)
  const bookCover = post.type === "Bok" ? (post.image || post.icon || getFirstImageFromContent(post.content)) : null
  const projectThumb = post.type === "Prosjekt" ? (post.image || getFirstImageFromContent(post.content)) : null
  const projectLinks = post.type === "Prosjekt" ? extractOutgoingLinks(post.content, post.url) : []
  // Only once the body content has been (pre)fetched — otherwise every card
  // would flash a bogus "1 min" from empty content.
  const readTime = (post.type === "Skriving" || post.type === "Bok") && post.content ? estimateReadTime(post.content) : 0
  // Reading time sits in the meta-pill row for reading posts without audio.
  const showReadTime = readTime > 0 && !post.lyd
  // The card's top image: the social image, else a link's og:image, else a
  // project's thumbnail. Bilete uses its own photo grid instead.
  const cardImage =
    post.sosialbilete ||
    (post.type === "Lenkje" ? (post.ogImage || post.image) : undefined) ||
    (post.type === "Prosjekt" ? (projectThumb || undefined) : undefined)
  // Book covers are portrait, so they sit beside the text rather than as a
  // full-bleed 1200×630 top image.
  const bokThumb = post.type === "Bok" && !cardImage && !!bookCover
  const urlHost = post.url
    ? (() => { try { return new URL(post.url).hostname.replace(/^www\./, '') } catch { return '' } })()
    : ''
  const tags = Array.isArray(post.tags) ? post.tags : []
  // Outlined meta pill (read time, link host, tags).
  const metaPill =
    "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-muted-foreground dark:border-gray-700"
  const figmaUrl = post.type === "Presentasjon" ? getFigmaEmbedUrl(post.content, post.url) : null
  // Reading-text posts get justified body text by default (with hyphenation so
  // the ragged-right gaps stay tight).
  const isProse = post.type === "Skriving" || post.type === "Bok"
  const linkHostname = post.type === "Lenkje" && post.url ? (() => { try { return new URL(post.url).hostname.replace('www.', '') } catch { return '' } })() : ''

  // Build list of navigable (non-.glb) images from thumbnails
  const galleryImages = useMemo(() => {
    if (!post.thumbnails) return []
    return post.thumbnails.filter(img => !img.src.endsWith('.glb'))
  }, [post.thumbnails])

  // A Bilete post with exactly one photo shows it as a full-width square
  // frame — same presentation as the 3D viewer — instead of a small grid cell.
  const singlePhoto =
    post.type === "Bilete" && post.thumbnails?.length === 1 && galleryImages.length === 1
      ? galleryImages[0]
      : null

  const renderTags = () => {
    return (
      <div className="flex gap-1.5 flex-wrap mt-2 items-center">
        <Badge
          className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium transition-colors border",
            getTagColor(post.type)
          )}
        >
          {post.type}
        </Badge>
        {Array.isArray(post.tags) && post.tags.map((tag) => (
          <Badge
            key={`${post.uid}-tag-${tag}`}
            className={cn(
              "text-xs px-2 py-0.5 rounded-sm font-medium transition-colors border",
              getTagColor(tag)
            )}
          >
            {tag}
          </Badge>
        ))}
      </div>
    )
  }

  // The card only opens inline when "Les meir" is enabled for the post; Lenkje
  // always deep-links out and Bilete opens its lightbox. Everything else is a
  // static (non-expanding) card by default.
  const isExpandable = post.type !== "Lenkje" && post.type !== "Bilete" && !!post.lesMeir

  const dateObj = new Date(post.date)
  const day = dateObj.getDate()
  const year = dateObj.getFullYear()

  const monthsFull = [
    "januar", "februar", "mars", "april", "mai", "juni", 
    "juli", "august", "september", "oktober", "november", "desember"
  ]
  const monthsShort = [
    "jan.", "feb.", "mars", "apr.", "mai", "juni", 
    "juli", "aug.", "sep.", "okt.", "nov.", "des."
  ]
  
  const monthIdx = dateObj.getMonth()
  const monthName = monthsFull[monthIdx]
  const month = monthName.length > 4 ? monthsShort[monthIdx] : monthName

  const handleCardClick = () => {
    // Lenkje deep-links out; every other card opens its full post page.
    if (post.type === "Lenkje" && post.url) {
      window.open(post.url, '_blank')
    } else {
      router.push(`/${post.type.toLowerCase()}/${post.slug}`)
    }
  }

  // A post whose whole body is a single attached 3D model renders as a bare
  // square viewer — no title, date or tags, just the frame (orbit-only).
  const modelOnlySrc =
    post.modelSrc ||
    post.content?.trim().match(/^<ModelViewer\s[^>]*src="([^"]+)"[^>]*\/>$/)?.[1]
  if (modelOnlySrc) {
    return (
      <div className="relative grid grid-cols-[auto,1fr] gap-2.5 sm:gap-4 max-w-full">
        <div className="w-9 sm:w-24 shrink-0 pt-3 sm:pt-5 pr-0 sm:pr-6 text-right">
          <time className="whitespace-nowrap lowercase text-muted-foreground leading-tight">
            <span className="font-extrabold text-sm sm:text-lg">{day}.</span>
            <span className="block sm:inline sm:ml-1 text-xs sm:text-lg">{month}</span>
          </time>
        </div>
        <div className="relative min-w-0">
          <div className="block">
            <TimelineNode type={post.type} onToggle={() => {}} />
            <TimelineConnector />
          </div>
          <div className="pb-8 pt-0">
            <ModelViewer
              src={modelOnlySrc}
              alt={post.title}
              disableZoom
              disablePan
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative grid grid-cols-[auto,1fr] gap-2.5 sm:gap-4 max-w-full">
      {/* Shorthand date in the timeline gutter, aligned with the node dot. */}
      <div className="w-9 sm:w-24 shrink-0 pt-3 sm:pt-5 pr-0 sm:pr-6 text-right">
        <time className="whitespace-nowrap lowercase text-muted-foreground leading-tight">
          <span className="font-extrabold text-sm sm:text-lg">{day}.</span>
          <span className="block sm:inline sm:ml-1 text-xs sm:text-lg">{month}</span>
          <span className="block text-[11px] sm:text-xs text-muted-foreground/70">{year}</span>
        </time>
      </div>
      <div className="relative min-w-0">
        <div className="block">
          <TimelineNode type={post.type} onToggle={handleCardClick} url={post.url} />
          <TimelineConnector />
        </div>
        <div className="pb-8 pt-0">
          <motion.article
            className={cn(
              // One card for every type: image on top, a white content section
              // below (category, title, description, meta pills). Same width and
              // shape throughout.
              "relative ml-0 overflow-hidden rounded-2xl border border-gray-200 bg-white transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900/40 dark:hover:border-gray-700",
              post.type === "Lenkje" ? "cursor-alias" : "cursor-pointer"
            )}
            onClick={handleCardClick}
            initial={false}
          >
            {/* MEDIA — full-bleed at the top of the card */}
            {post.type === "Bilete" && post.thumbnails && post.thumbnails.length > 0 ? (
              <div className={cn("grid gap-0.5 bg-gray-100 dark:bg-gray-800", post.thumbnails.length === 1 ? "grid-cols-1" : "grid-cols-3")}>
                {post.thumbnails.slice(0, post.thumbnails.length === 1 ? 1 : 6).map((img, i) => {
                  const isLast = i === 5 && post.thumbnails!.length > 6
                  return (
                    <div
                      key={`${post.uid}-thumb-${i}`}
                      className={cn(
                        "relative overflow-hidden",
                        post.thumbnails!.length === 1 ? "aspect-[1200/630]" : "aspect-square",
                        !img.src.endsWith('.glb') && "cursor-pointer"
                      )}
                      onClick={(e) => {
                        if (!img.src.endsWith('.glb')) {
                          e.stopPropagation()
                          const gi = galleryImages.findIndex(g => g.src === img.src)
                          if (gi !== -1) setEnlargedImageIndex(gi)
                        }
                      }}
                    >
                      {img.src.endsWith('.glb') ? (
                        <ModelViewer src={img.src} alt={img.alt} disableZoom disablePan className="h-full w-full" />
                      ) : (
                        <NextImage src={img.src} alt={img.alt} fill className="object-cover" sizes="(max-width: 640px) 33vw, 200px" loading="lazy" loader={loaderFor(img.src)} />
                      )}
                      {isLast && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white">
                          +{post.thumbnails!.length - 6}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : cardImage ? (
              <div className="relative aspect-[1200/630] bg-gray-100 dark:bg-white/[0.03]">
                {post.type === "Lenkje" ? (
                  // ogImage is an arbitrary external URL not in remotePatterns
                  <img
                    src={notionImgSrc(cardImage, 1280)}
                    srcSet={notionImgSrcSet(cardImage, [640, 960, 1280])}
                    sizes="(min-width: 1152px) 620px, 100vw"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <ProgressiveImage fill objectFit="cover" src={cardImage} widths={[640, 960, 1280]} sizes="(min-width: 1152px) 620px, 100vw" fullWidth={1280} />
                )}
              </div>
            ) : null}

            {/* CONTENT — white section below the image */}
            <div className="p-4">
              <div className={cn(bokThumb && "flex gap-4")}>
                {bokThumb && (
                  <div className="relative w-16 sm:w-20 aspect-[2/3] shrink-0 overflow-hidden rounded-sm border border-gray-100 shadow-md dark:border-gray-800">
                    <NextImage src={bookCover!} alt={`Omslag for ${post.title}`} fill className="object-cover" sizes="80px" loader={loaderFor(bookCover!)} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className={cn("mb-1 text-[11px] font-bold uppercase tracking-wide", typeTextColor[post.type] || "text-muted-foreground")}>
                    {post.type}
                  </div>
                  {post.type === "Lenkje" ? (
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight line-clamp-2">{post.ogTitle || post.title}</h2>
                  ) : (
                    <Link href={`/${post.type.toLowerCase()}/${post.slug}`} onClick={(e) => e.stopPropagation()}>
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight decoration-2 underline-offset-2 hover:underline">{post.title}</h2>
                    </Link>
                  )}
                  {post.description && (
                    <p lang="nn" className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{post.description}</p>
                  )}
                  {(showReadTime || urlHost || tags.length > 0 || (post.type === "Prosjekt" && projectLinks.length > 0)) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {showReadTime && (
                        <span className={metaPill}><Clock className="h-3.5 w-3.5" />{readTime} min å lese</span>
                      )}
                      {urlHost && (
                        <a href={post.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={cn(metaPill, "transition-colors hover:border-gray-300 hover:text-foreground dark:hover:border-gray-600")}>
                          <Globe className="h-3.5 w-3.5" />{urlHost}
                        </a>
                      )}
                      {tags.map((tag) => (
                        <span key={`${post.uid}-tag-${tag}`} className={metaPill}><Tag className="h-3 w-3" />{tag}</span>
                      ))}
                      {post.type === "Prosjekt" && projectLinks.filter((l) => l.type !== 'external').map((link) => (
                        <a key={link.type} href={link.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={cn(metaPill, "capitalize transition-colors hover:text-foreground")} aria-label={link.type}>
                          {link.type === 'github' ? <Github className="h-3.5 w-3.5" /> : link.type === 'twitter' ? <Twitter className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
                          {link.type}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {post.lyd && post.type !== "Lenkje" && (
                <div className="mt-3">
                  <AudioPlayer src={post.lyd} title={post.title} variant="bar" />
                </div>
              )}
            </div>
          </motion.article>

          {/* Image gallery lightbox with navigation, gestures, keyboard support */}
          {galleryImages.length > 0 && (
            <ImageGallery
              images={galleryImages}
              viewerOnly
              initialIndex={enlargedImageIndex}
              onIndexChange={setEnlargedImageIndex}
            />
          )}
        </div>
      </div>
    </div>
  )
}
