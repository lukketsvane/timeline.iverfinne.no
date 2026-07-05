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
import { HtmlIframe } from "@/components/html-iframe"
import { ModelViewer } from "@/components/model-viewer"
import { AudioPlayer } from "@/components/audio-player"
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
  lesMeir?: boolean
  thumbnails?: { src: string; alt: string }[]
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  modelSrc?: string
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

// Shared timeline gutter — must stay in sync with the year rows in mdx-blog.tsx.
export const TIMELINE_GRID = "grid grid-cols-[4.25rem,1fr] sm:grid-cols-[5.5rem,1fr]"

const TimelineConnector = () => (
  <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-800 -translate-x-1/2" />
)

const TimelineNode = ({ onActivate, label }: { onActivate: () => void; label: string }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onActivate() }}
    className="absolute left-0 top-6 z-10 h-2.5 w-2.5 -translate-x-1/2 cursor-pointer rounded-full bg-foreground ring-4 ring-background transition-transform hover:scale-125"
    aria-label={label}
  />
)

// Coloured small-caps category label at the top of each card.
const typeLabelColors: Record<string, string> = {
  Skriving: "text-blue-600 dark:text-blue-400",
  Bok: "text-emerald-600 dark:text-emerald-400",
  Prosjekt: "text-violet-600 dark:text-violet-400",
  Lenkje: "text-orange-600 dark:text-orange-400",
  Interaktiv: "text-pink-600 dark:text-pink-400",
  Bilete: "text-teal-600 dark:text-teal-400",
  Presentasjon: "text-indigo-600 dark:text-indigo-400",
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
  const readTime = post.type === "Skriving" ? estimateReadTime(post.content) : 0
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

  const hasTags = Array.isArray(post.tags) && post.tags.length > 0

  // Meta row: neutral tag chips when the post has tags, otherwise the read
  // time — mirrors the mockup where a card shows one or the other.
  const renderMeta = () => {
    if (!hasTags && readTime <= 0) return null
    return (
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {hasTags ? (
          (post.tags as string[]).map((tag) => (
            <span
              key={`${post.uid}-tag-${tag}`}
              className="rounded-md border border-gray-200 bg-transparent px-2 py-0.5 text-xs font-medium text-muted-foreground dark:border-gray-700"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {readTime} min
          </span>
        )}
      </div>
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
  
  const monthIdx = dateObj.getMonth()
  const monthName = monthsFull[monthIdx]
  const month = monthName.length > 4 ? monthsShort[monthIdx] : monthName

  const postHref = `/${post.type.toLowerCase()}/${post.slug}`

  // Lenkje opens its target; posts with "Les meir" on expand inline; every
  // other card navigates straight to its own page.
  const handleCardClick = () => {
    if (post.type === "Lenkje" && post.url) {
      window.open(post.url, '_blank')
    } else if (post.lesMeir) {
      onToggle()
    } else {
      router.push(postHref)
    }
  }

  // Right-hand illustration in the card (mockup 2). Book covers keep their
  // portrait format; everything else prefers the social image, then the cover.
  const sideImage =
    post.type === "Bok"
      ? bookCover
      : post.type === "Prosjekt"
        ? (projectThumb || post.sosialbilete)
        : (post.sosialbilete || post.image)

  const dateGutter = (
    <div className="pt-5 pr-3 text-right sm:pr-5">
      <time className="block leading-tight">
        <span className="block text-sm font-bold text-gray-500 dark:text-gray-400">{day}.</span>
        <span className="block text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{month}</span>
      </time>
    </div>
  )

  // A post whose whole body is a single attached 3D model renders as a bare
  // square viewer — no title, date or tags, just the frame (orbit-only).
  const modelOnlySrc =
    post.modelSrc ||
    post.content?.trim().match(/^<ModelViewer\s[^>]*src="([^"]+)"[^>]*\/>$/)?.[1]
  if (modelOnlySrc) {
    return (
      <div className={cn("relative max-w-full", TIMELINE_GRID)}>
        {dateGutter}
        <div className="relative min-w-0 pl-4 sm:pl-6">
          <TimelineConnector />
          <TimelineNode onActivate={() => {}} label={post.title} />
          <div className="pb-6">
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
    <div className={cn("relative max-w-full", TIMELINE_GRID)}>
      {dateGutter}
      <div className="relative min-w-0 pl-4 sm:pl-6">
        <TimelineConnector />
        <TimelineNode
          onActivate={handleCardClick}
          label={post.type === "Lenkje" ? "Opna lenkje" : post.lesMeir ? "Utvid eller skjul innhald" : `Opna ${post.title}`}
        />
        <div className="pb-6">
          <motion.article
            className={cn(
              "relative overflow-hidden rounded-2xl transition-colors",
              post.type === "Lenkje"
                ? "cursor-alias"
                : "cursor-pointer border border-gray-200/80 bg-white shadow-sm hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
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
              <div className="relative border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
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

            {/* Main Content Section — text column left, illustration right */}
            {post.type !== "Bilete" && post.type !== "Lenkje" && (
              <div className="flex items-start gap-4 p-4 sm:gap-5 sm:p-5">
                <div className="group/title min-w-0 flex-1">
                  <p className={cn("text-[11px] font-bold uppercase tracking-[0.1em]", typeLabelColors[post.type] || "text-gray-500")}>
                    {post.type}
                  </p>
                  <Link href={postHref} onClick={(e) => e.stopPropagation()}>
                    <h2 className="mt-1 text-lg font-bold leading-snug tracking-tight group-hover/title:underline decoration-2 underline-offset-2 sm:text-xl">
                      {post.title}
                    </h2>
                  </Link>
                  {post.description && (
                    <p
                      lang="nn"
                      className={cn(
                        "mt-1.5 text-sm leading-relaxed text-muted-foreground",
                        !isExpanded && "line-clamp-3"
                      )}
                    >
                      {post.description}
                    </p>
                  )}
                  {post.lesMeir && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggle() }}
                      className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-foreground transition-colors hover:text-muted-foreground"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "Les mindre" : "Les meir"}
                      <ArrowRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                    </button>
                  )}
                  {/* Social/outgoing link icons for Prosjekt */}
                  {post.type === "Prosjekt" && projectLinks.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
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
                  {renderMeta()}
                </div>

                {/* Illustration — right aligned; book covers keep 2:3 */}
                {sideImage && (
                  <div
                    className={cn(
                      "shrink-0 overflow-hidden",
                      post.type === "Bok"
                        ? "relative aspect-[2/3] w-20 rounded-sm border border-gray-100 shadow-md dark:border-gray-800 sm:w-24"
                        : "w-28 self-center rounded-lg sm:w-40"
                    )}
                  >
                    <img
                      src={notionImgSrc(sideImage, 480)}
                      srcSet={notionImgSrcSet(sideImage, [240, 480, 960])}
                      sizes="(max-width: 640px) 112px, 160px"
                      alt={post.type === "Bok" ? `Omslag for ${post.title}` : ""}
                      loading="lazy"
                      className={
                        post.type === "Bok"
                          ? "absolute inset-0 h-full w-full object-cover"
                          : "h-auto w-full object-contain"
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {/* Bilete: no title — category label, then the photo(s), then tags */}
            {post.type === "Bilete" && (
              <div className="p-4 sm:p-5">
                <p className={cn("mb-3 text-[11px] font-bold uppercase tracking-[0.1em]", typeLabelColors.Bilete)}>
                  Bilete
                </p>
                {singlePhoto ? (
                  // Single photo: one big square frame, like the 3D viewer
                  <div
                    className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-900"
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
                ) : post.thumbnails && post.thumbnails.length > 0 ? (
                  <div className="grid max-w-[620px] grid-cols-4 gap-1">
                    {post.thumbnails.slice(0, 8).map((img, i) => {
                      const isLastVisible = i === 7 && post.thumbnails!.length > 8;

                      return (
                        <div
                          key={`${post.uid}-thumb-${i}`}
                          className={cn(
                            "aspect-square relative rounded-sm overflow-hidden group/thumb",
                            !img.src.endsWith('.glb') && "cursor-pointer"
                          )}
                          onClick={(e) => {
                            if (!img.src.endsWith('.glb')) {
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
                ) : null}
                {renderMeta()}
              </div>
            )}

            {/* Expanded Content — only reachable when the post's "Les meir"
                checkbox is on in Notion */}
            <AnimatePresence initial={false}>
              {post.lesMeir && isExpanded && post.type !== "Bilete" && post.type !== "Lenkje" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    height: { type: 'spring', stiffness: 400, damping: 40, mass: 0.8 },
                    opacity: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }
                  }}
                  className="overflow-hidden"
                >
                  <div
                    lang="nn"
                    className={cn(
                      "prose dark:prose-invert max-w-none text-base leading-normal overflow-hidden break-words",
                      "border-t border-gray-100 dark:border-gray-800 px-4 pb-5 pt-4 sm:px-5",
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

            {/* Audio row — round play button + full-width scrubber (mockup 1) */}
            {post.lyd && post.type !== "Lenkje" && (
              <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-5">
                <AudioPlayer src={post.lyd} title={post.title} variant="card" />
              </div>
            )}
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
