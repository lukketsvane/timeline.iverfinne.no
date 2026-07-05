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
  <div className="absolute -left-2.5 sm:-left-3 w-0.5 top-0 bottom-0 bg-gray-200 dark:bg-gray-700 -translate-x-1/2" />
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
        "absolute -left-2.5 sm:-left-3 top-4 w-4 h-4 sm:w-5 sm:h-5 rounded-full -translate-x-1/2 border-2 border-white dark:border-gray-900 z-10 transition-transform hover:scale-125 cursor-pointer",
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
  const [enlargedImageIndex, setEnlargedImageIndex] = useState<number | null>(null)
  const bookCover = post.type === "Bok" ? (post.image || post.icon || getFirstImageFromContent(post.content)) : null
  const projectThumb = post.type === "Prosjekt" ? (post.image || getFirstImageFromContent(post.content)) : null
  const projectLinks = post.type === "Prosjekt" ? extractOutgoingLinks(post.content, post.url) : []
  // Only once the body content has been (pre)fetched — otherwise every card
  // would flash a bogus "1 min" from empty content.
  const readTime = (post.type === "Skriving" || post.type === "Bok") && post.content ? estimateReadTime(post.content) : 0
  // Reading time sits in the category row for reading posts without audio.
  const showReadTime = readTime > 0 && !post.lyd
  // Non-audio posts with a social image get the bold treatment: the 1200×630
  // image fills the top of the card with the title/category overlaid on it.
  // Audio posts stay compact (image, then text + scrubber below).
  const heroOverlay =
    !!post.sosialbilete && !post.lyd && post.type !== "Bilete" && post.type !== "Lenkje"
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
    if (post.type === "Lenkje" && post.url) {
      window.open(post.url, '_blank')
    } else if (isExpandable) {
      onToggle()
    }
    // Non-expandable cards do nothing on body click — the title still links to
    // the full post page.
  }

  // A post whose whole body is a single attached 3D model renders as a bare
  // square viewer — no title, date or tags, just the frame (orbit-only).
  const modelOnlySrc =
    post.modelSrc ||
    post.content?.trim().match(/^<ModelViewer\s[^>]*src="([^"]+)"[^>]*\/>$/)?.[1]
  if (modelOnlySrc) {
    return (
      <div className="relative grid grid-cols-[auto,1fr] gap-5 sm:gap-6 max-w-full">
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
    <div className="relative grid grid-cols-[auto,1fr] gap-5 sm:gap-6 max-w-full">
      {/* Shorthand date in the timeline gutter, aligned with the node dot. */}
      <div className="w-9 sm:w-24 shrink-0 pt-3 sm:pt-5 pr-0 sm:pr-6 text-right">
        <time className="whitespace-nowrap lowercase text-muted-foreground leading-tight">
          <span className="font-extrabold text-sm sm:text-lg">{day}.</span>
          <span className="block sm:inline sm:ml-1 text-xs sm:text-lg">{month}</span>
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
              "relative transition-colors ml-0",
              post.type === "Lenkje"
                ? "rounded-lg p-4 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-alias"
                : post.type === "Bilete"
                  ? "rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
                  : cn(
                      // Standard cards are bounded: soft surface, hairline border,
                      // rounded corners — the illustration sits inside, not full-bleed.
                      "overflow-hidden rounded-2xl border border-gray-200/70 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.03]",
                      isExpandable
                        ? "cursor-pointer hover:border-gray-300 dark:hover:border-gray-700"
                        : "",
                    )
            )}
            onClick={handleCardClick}
            initial={false}
          >
            {/* Lenkje Bookmark Preview */}
            {post.type === "Lenkje" && (() => {
              const title = post.ogTitle || post.title
              // sosialbilete override takes priority over the link target's og:image
              const image = post.sosialbilete || post.ogImage || post.image
              const hostRow = linkHostname && (
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${linkHostname}&sz=16`}
                    alt=""
                    width={14}
                    height={14}
                    className="rounded-sm"
                  />
                  <span className="truncate">{linkHostname}</span>
                </div>
              )
              return (
              // Compact link card: just the image with the site + title overlaid on
              // a gradient scrim. No separate description section.
              <div className="relative border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                {image ? (
                  <div className="relative w-full aspect-[1.91/1] bg-gray-100 dark:bg-gray-800">
                    {/* Use plain <img> — ogImage is an arbitrary external URL not in remotePatterns */}
                    <img
                      src={notionImgSrc(image, 960)}
                      srcSet={notionImgSrcSet(image, [640, 960, 1280])}
                      sizes="(min-width: 1152px) 990px, 100vw"
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-black/75 via-black/35 to-transparent text-white">
                      <div className="text-white/80 mb-0.5">{hostRow}</div>
                      <h2 className="text-base sm:text-lg font-semibold tracking-tight line-clamp-2 drop-shadow-sm">
                        {title}
                      </h2>
                    </div>
                  </div>
                ) : (
                  // Fallback when the link has no image
                  <div className="p-3 sm:p-4 min-w-0 bg-gray-50 dark:bg-gray-800/40">
                    <div className="text-muted-foreground mb-1.5">{hostRow}</div>
                    <h2 className="text-base sm:text-lg font-semibold tracking-tight line-clamp-2">
                      {title}
                    </h2>
                  </div>
                )}
              </div>
              )
            })()}

            {/* Main Content Section */}
            {post.type !== "Bilete" && post.type !== "Lenkje" && (
              <div>
                {heroOverlay ? (
                  /* NON-AUDIO with a social image: the 1200×630 image fills the
                     top of the card and the category/title sit on a scrim over
                     it. Bleeds to the card edges (cancels the p-4). */
                  <div className={cn(
                    "relative -mx-4 -mt-4 aspect-[1200/630] overflow-hidden rounded-t-2xl bg-gray-100 dark:bg-white/[0.03]",
                    post.lesMeir ? "mb-4" : "-mb-4"
                  )}>
                    <ProgressiveImage
                      fill
                      objectFit="cover"
                      src={post.sosialbilete!}
                      widths={[640, 960, 1280]}
                      sizes="(min-width: 1152px) 620px, 100vw"
                      fullWidth={1280}
                    />
                    <div className="group/title absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/25 to-transparent">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-white/85">{post.type}</span>
                        {showReadTime && (
                          <span className="flex shrink-0 items-center text-xs text-white/80">
                            <Clock className="mr-1 h-3.5 w-3.5" />{readTime} min
                          </span>
                        )}
                      </div>
                      <Link href={`/${post.type.toLowerCase()}/${post.slug}`} onClick={(e) => e.stopPropagation()}>
                        <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-white drop-shadow-sm group-hover/title:underline decoration-2 underline-offset-2">
                          {post.title}
                        </h2>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Audio / other posts: compact — image fills the top, text
                        and (for audio) the scrubber sit below it. */}
                    {post.sosialbilete && (
                      <div className="relative -mx-4 -mt-4 mb-3 aspect-[1200/630] overflow-hidden rounded-t-2xl bg-gray-100 dark:bg-white/[0.03]">
                        <ProgressiveImage
                          fill
                          objectFit="cover"
                          src={post.sosialbilete}
                          widths={[640, 960, 1280]}
                          sizes="(min-width: 1152px) 620px, 100vw"
                          fullWidth={1280}
                        />
                      </div>
                    )}
                    <div className="flex items-start gap-4">
                      {post.type === "Bok" && !post.sosialbilete && bookCover && (
                        <div className="relative w-20 sm:w-24 aspect-[2/3] shrink-0 shadow-md rounded-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                          <NextImage
                            src={bookCover}
                            alt={`Omslag for ${post.title}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 80px, 96px"
                            loader={loaderFor(bookCover)}
                          />
                        </div>
                      )}
                      <div className="flex-1 group/title min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className={cn("text-xs font-semibold uppercase tracking-wide", typeTextColor[post.type] || "text-muted-foreground")}>
                            {post.type}
                          </span>
                          {showReadTime && (
                            <span className="flex shrink-0 items-center text-xs text-muted-foreground">
                              <Clock className="mr-1 h-3.5 w-3.5" />{readTime} min
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-start gap-2 flex-wrap">
                          <Link href={`/${post.type.toLowerCase()}/${post.slug}`} onClick={(e) => e.stopPropagation()}>
                            <h2 className="text-2xl font-semibold tracking-tight group-hover/title:underline decoration-2 underline-offset-2 transition-colors">
                              {post.title}
                            </h2>
                          </Link>
                          {post.type === "Prosjekt" && projectLinks.length > 0 && (
                            <div className="flex items-center gap-1.5 pt-1.5">
                              {projectLinks.map((link) => (
                                <a
                                  key={link.type}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                  aria-label={link.type}
                                >
                                  {link.type === 'github' && <Github className="w-4 h-4" />}
                                  {link.type === 'instagram' && (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                                  )}
                                  {link.type === 'linkedin' && (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                                  )}
                                  {link.type === 'twitter' && <Twitter className="w-4 h-4" />}
                                  {link.type === 'external' && <ExternalLink className="w-4 h-4" />}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {post.type === "Prosjekt" && !post.sosialbilete && projectThumb && (
                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-800">
                          <NextImage
                            src={projectThumb}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="80px"
                            loader={loaderFor(projectThumb)}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Description, read-more toggle and tags — only when "Les meir"
                    is enabled for the post (a Notion checkbox, off by default). */}
                {post.lesMeir && (
                  <div className="mt-2">
                    {post.description && (
                      <p
                        lang="nn"
                        className={cn(
                          "text-muted-foreground text-sm font-serif",
                          isProse && "text-justify hyphens-auto",
                          !isExpanded && "line-clamp-3"
                        )}
                      >
                        {post.description}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggle() }}
                      className="inline-flex items-center gap-1 mt-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "Les mindre" : "Les meir"}
                      <ArrowRight className={cn("w-4 h-4 transition-transform", isExpanded && "-rotate-90")} />
                    </button>
                    {renderTags()}
                  </div>
                )}
              </div>
            )}

            {/* Single-photo Bilete: one big square frame, like the 3D viewer */}
            {singlePhoto && (
              <div
                className="relative mb-4 aspect-square w-full cursor-pointer overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-900"
                onClick={(e) => {
                  e.stopPropagation()
                  setEnlargedImageIndex(0)
                }}
              >
                <NextImage
                  src={singlePhoto.src}
                  alt={singlePhoto.alt}
                  fill
                  className="object-cover"
                  sizes="(min-width: 1152px) 990px, 100vw"
                  loader={loaderFor(singlePhoto.src)}
                />
              </div>
            )}

            {/* Image Grid for "Bilete" or Thumbnails for others */}
            {!singlePhoto && post.type !== "Skriving" && post.type !== "Bok" && post.thumbnails && post.thumbnails.length > 0 && (
              <div className={cn(
                "grid gap-1 mb-4 max-w-[620px]",
                post.type === "Bilete" ? "grid-cols-4" : "grid-cols-3"
              )}>
                {(post.type === "Bilete" ? post.thumbnails.slice(0, 8) : post.thumbnails.slice(0, 3)).map((img, i) => {
                  const isLastVisible = post.type === "Bilete" && i === 7 && post.thumbnails!.length > 8;

                  return (
                    <div 
                      key={`${post.uid}-thumb-${i}`}
                      className={cn(
                        "aspect-square relative rounded-sm overflow-hidden group/thumb",
                        post.type === "Bilete" && !img.src.endsWith('.glb') && "cursor-pointer"
                      )}
                      onClick={(e) => {
                        if (post.type === "Bilete" && !img.src.endsWith('.glb')) {
                          e.stopPropagation()
                          const galleryIdx = galleryImages.findIndex(g => g.src === img.src)
                          if (galleryIdx !== -1) setEnlargedImageIndex(galleryIdx)
                        }
                      }}
                    >
                      {img.src.endsWith('.glb') ? (
                        <ModelViewer 
                          src={img.src} 
                          alt={img.alt} 
                          disableZoom={true} 
                          disablePan={true}
                          className="h-full w-full"
                        />
                      ) : (
                        <NextImage
                          src={img.src}
                          alt={img.alt}
                          fill
                          className="object-contain"
                          sizes="(max-width: 640px) 25vw, 155px"
                          loading="lazy"
                          loader={loaderFor(img.src)}
                        />
                      )}
                      
                      {/* Plus overlay for the 9th image if there are more */}
                      {isLastVisible && (
                        <div className="absolute inset-0 bg-black/5 flex items-center justify-center pointer-events-none group-hover/thumb:bg-black/20 transition-colors">
                          <Plus className="text-white w-8 h-8 opacity-20 group-hover/thumb:opacity-60 transition-opacity" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Special layout for Bilete type since title is hidden */}
            {post.type === "Bilete" && renderTags()}

            {/* Audio scrubber — full-width bar under the card content, shown for
                any post with audio regardless of the "Les meir" setting. */}
            {post.lyd && post.type !== "Lenkje" && (
              <div className="mt-1">
                <AudioPlayer src={post.lyd} title={post.title} variant="bar" />
              </div>
            )}

            {/* Expanded Content */}
            <AnimatePresence initial={false}>
              {isExpanded && isExpandable && post.type !== "Bilete" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    height: { type: 'spring', stiffness: 400, damping: 40, mass: 0.8 },
                    opacity: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }
                  }}
                  className="overflow-hidden mt-3 border-t border-gray-100 dark:border-gray-800 pt-4"
                >
                  <div
                    lang="nn"
                    className={cn(
                      "prose dark:prose-invert max-w-none text-base leading-normal overflow-hidden break-words",
                      isProse && "text-justify hyphens-auto prose-p:text-justify"
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {post.type === "Presentasjon" && figmaUrl ? (
                      <div className="aspect-video w-full rounded-lg overflow-hidden">
                        <iframe
                          src={figmaUrl}
                          className="w-full h-full border-0"
                          allowFullScreen
                        />
                      </div>
                    ) : post.type === "Interaktiv" ? (
                      <HtmlIframe content={post.content} />
                    ) : (
                      <>
                        {serializedContent ? (
                          <MDXRemote
                            {...serializedContent}
                            components={{
                              ...mdxComponents,
                              WebDesignKeys,
                              ...(post.type === "Bok" && bookCover ? {
                                img: (props: any) => {
                                  if (props.src === bookCover) return null
                                  return <img {...props} className="max-w-full h-auto rounded-lg mb-4" />
                                }
                              } : {})
                            }}
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
