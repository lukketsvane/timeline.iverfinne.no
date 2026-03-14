'use client'

import { useState, useMemo, useRef, useEffect } from "react"
import NextImage from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MDXRemote } from 'next-mdx-remote'
import type { MDXRemoteSerializeResult } from 'next-mdx-remote'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from "@/lib/utils"
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
import { getTagColor } from "@/lib/tag-utils"
import { ImageGallery } from "@/components/image-gallery"
import { HtmlIframe } from "@/components/html-iframe"
import { ResponsiveIframe } from "@/components/responsive-iframe"
import { ModelViewer } from "@/components/model-viewer"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const WebDesignKeys = dynamic(() => import('@/components/WebDesignKeys'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center"></div>
})

const mdxComponents = {
  h1: (props: any) => <h1 {...props} className="text-2xl font-bold mt-4 mb-2 break-words" />,
  h2: (props: any) => <h2 {...props} className="text-xl font-semibold mt-3 mb-2 break-words" />,
  h3: (props: any) => <h3 {...props} className="text-lg font-medium mt-2 mb-1 break-words" />,
  h4: (props: any) => <h4 {...props} className="text-base font-medium mt-2 mb-1 break-words" />,
  h5: (props: any) => <h5 {...props} className="text-sm font-medium mt-2 mb-1 break-words" />,
  h6: (props: any) => <h6 {...props} className="text-xs font-medium mt-2 mb-1 break-words" />,
  p: (props: any) => <p {...props} className="break-words font-serif text-base" />,
  pre: (props: any) => <pre {...props} className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words" />,
  code: (props: any) => <code {...props} className="bg-gray-800 text-gray-100 rounded px-1.5 py-0.5 whitespace-pre-wrap break-words" />,
  ImageGallery: ImageGallery,
  ModelViewer: ModelViewer,
  Button: Button,
  Textarea: Textarea,
  Input: Input,
  Badge: Badge,
  Card: Card,
  CardHeader: CardHeader,
  CardTitle: CardTitle,
  CardDescription: CardDescription,
  CardContent: CardContent,
  CardFooter: CardFooter,
  // Icons
  Minus: Minus,
  Plus: Plus,
  Trash2: Trash2,
  X: X,
  Check: Check,
  ChevronRight: ChevronRight,
  ChevronLeft: ChevronLeft,
  ExternalLink: ExternalLink,
  Github: Github,
  Twitter: Twitter,
  Mail: Mail,
  Globe: Globe,
  Calendar: Calendar,
  Clock: Clock,
  User: User,
  Tag: Tag,
  Search: Search,
  Menu: Menu,
  ArrowRight: ArrowRight,
  ArrowLeft: ArrowLeft,
  Settings: Settings,
  Info: Info,
  AlertCircle: AlertCircle,
  AlertTriangle: AlertTriangle,
  Eye: Eye,
  EyeOff: EyeOff,
  Copy: Copy,
  Download: Download,
  Share2: Share2,
  Heart: Heart,
  Star: Star,
  Home: Home,
  Image: (props: any) => {
    if (!props.width && !props.height && !props.fill) {
      return <img {...props} className="max-w-full h-auto rounded-lg mb-4" />
    }
    return <NextImage {...props} />
  },
  img: (props: any) => <img {...props} className="max-w-full h-auto rounded-lg mb-4" />,
  iframe: (props: any) => (
    <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden mb-4">
      <iframe {...props} className="absolute inset-0 w-full h-full border-0" />
    </div>
  ),
  material: (props: any) => <div {...props} />,
  ResponsiveIframe: ResponsiveIframe,
}

interface Post {
  uid: string
  title: string
  description: string
  date: string
  tags: string[] | string | undefined
  slug: string
  type: "Skriving" | "Bok" | "Prosjekt" | "Lenkje" | "Interaktiv" | "Bilete"
  image?: string
  coverimage?: string
  content: string
  url?: string
  icon?: string
  thumbnails?: { src: string; alt: string }[]
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
}

interface MDXCardProps {
  post: Post
  isExpanded: boolean
  onToggle: () => void
  serializedContent: MDXRemoteSerializeResult | null
}

const TimelineConnector = () => (
  <div className="absolute left-0 sm:left-0 w-0.5 top-0 bottom-0 bg-gray-200 dark:bg-gray-700 -translate-x-1/2" />
)

const TimelineNode = ({ type, onToggle, url }: { type: string, onToggle: () => void, url?: string }) => {
  const typeColors = {
    Skriving: "bg-blue-500",
    Bok: "bg-green-500",
    Prosjekt: "bg-purple-500",
    Lenkje: "bg-orange-500",
    Interaktiv: "bg-pink-500",
    Bilete: "bg-teal-500"
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
        "absolute left-0 sm:left-0 top-[1.125rem] w-3 h-3 sm:w-4 sm:h-4 rounded-full -translate-x-1/2 border-2 border-white dark:border-gray-900 z-10 transition-transform hover:scale-125 cursor-pointer",
        typeColors[type as keyof typeof typeColors] || "bg-gray-500"
      )} 
      aria-label={type === "Lenkje" ? "Opna lenkje" : "Utvid eller skjul innhald"}
    />
  )
}

function getFirstImageFromContent(content: string): string | null {
  if (!content) return null
  const match = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)
  if (match) return match[1]
  const imgMatch = content.match(/<img[^>]+src=["'](https?:\/\/[^\s"']+)["']/)
  if (imgMatch) return imgMatch[1]
  return null
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
}

export function MDXCard({ post, isExpanded, onToggle, serializedContent }: MDXCardProps) {
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<number | null>(null)
  const bookCover = post.type === "Bok" ? (post.image || post.icon || getFirstImageFromContent(post.content)) : null
  const projectThumb = post.type === "Prosjekt" ? (post.image || getFirstImageFromContent(post.content)) : null
  const projectLinks = post.type === "Prosjekt" ? extractOutgoingLinks(post.content, post.url) : []
  const linkHostname = post.type === "Lenkje" && post.url ? (() => { try { return new URL(post.url).hostname.replace('www.', '') } catch { return '' } })() : ''

  const renderTags = () => {
    return (
      <div className="flex gap-1.5 flex-wrap mt-2">
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
    if (post.type === "Bilete") {
      setSelectedGalleryImage(0)
    } else if (post.type === "Lenkje" && post.url) {
      window.open(post.url, '_blank')
    } else {
      onToggle()
    }
  }

  return (
    <div className="relative grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-4 max-w-full pl-4 sm:pl-0">
      <div className="hidden sm:block text-right pt-5 pr-6 w-24 shrink-0">
        <time className="text-lg font-semibold text-muted-foreground whitespace-nowrap lowercase">
          <span className="font-extrabold">{day}.</span> {month}
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
              "relative rounded-lg p-4 transition-colors",
              post.type === "Lenkje"
                ? "hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-alias"
                : (isExpanded ? "dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"),
              "ml-0"
            )}
            onClick={handleCardClick}
            initial={false}
          >
            {/* Lenkje Bookmark Preview */}
            {post.type === "Lenkje" && (() => {
              const title = post.ogTitle || post.title
              const description = post.ogDescription || post.description
              const image = post.ogImage || post.image
              return (
              <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <div className="flex-1 p-3 sm:p-4 min-w-0 flex flex-col justify-center">
                  <h2 className="text-base sm:text-lg font-semibold tracking-tight line-clamp-1 mb-1">
                    {title}
                  </h2>
                  {description && (
                    <p className="text-muted-foreground text-xs sm:text-sm line-clamp-2 mb-2">{description}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {linkHostname && (
                      <>
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${linkHostname}&sz=16`}
                          alt=""
                          width={14}
                          height={14}
                          className="rounded-sm"
                        />
                        <span className="truncate">{linkHostname}</span>
                      </>
                    )}
                  </div>
                </div>
                {image && (
                  <div className="relative w-32 sm:w-44 shrink-0 bg-gray-100 dark:bg-gray-800">
                    <NextImage
                      src={image}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="176px"
                    />
                  </div>
                )}
              </div>
              )
            })()}

            {/* Main Content Section */}
            {post.type !== "Bilete" && post.type !== "Lenkje" && (
              <div className="flex items-start gap-4 mb-4">
                {/* Book Cover - Left Aligned */}
                {post.type === "Bok" && bookCover && (
                  <div className="relative w-20 sm:w-24 aspect-[2/3] shrink-0 shadow-md rounded-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                    <NextImage
                      src={bookCover}
                      alt={`Omslag for ${post.title}`}
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="(max-width: 640px) 80px, 96px"
                    />
                  </div>
                )}

                <div className="flex-1 group/title min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/${post.type.toLowerCase()}/${post.slug}`} onClick={(e) => e.stopPropagation()}>
                      <h2 className="text-2xl font-semibold tracking-tight mb-2 group-hover/title:text-blue-600 transition-colors">
                        {post.title}
                      </h2>
                    </Link>
                    {/* Social/outgoing link icons for Prosjekt */}
                    {post.type === "Prosjekt" && projectLinks.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-2">
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
                  <time className="block sm:hidden text-sm text-muted-foreground mb-2 lowercase">
                    <span className="font-extrabold">{day}.</span> {month}
                  </time>
                  <p className="text-muted-foreground text-sm font-serif">{post.description}</p>
                  {renderTags()}
                </div>

                {/* Project thumbnail - Right Aligned */}
                {post.type === "Prosjekt" && projectThumb && (
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-800">
                    <NextImage
                      src={projectThumb}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="80px"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Image Grid for "Bilete" or Thumbnails for others */}
            {post.type !== "Skriving" && post.type !== "Bok" && post.thumbnails && post.thumbnails.length > 0 && (
              <div className={cn(
                "grid gap-1 mb-4 max-w-[620px]",
                post.type === "Bilete" ? "grid-cols-4" : "grid-cols-3"
              )}>
                {(post.type === "Bilete" ? post.thumbnails.slice(0, 8) : post.thumbnails.slice(0, 3)).map((img, i) => {
                  const isLastVisible = post.type === "Bilete" && i === 7 && post.thumbnails!.length > 8;

                  return (
                    <div 
                      key={`${post.uid}-thumb-${i}`}
                      className="aspect-square relative bg-gray-100 dark:bg-gray-800 rounded-sm overflow-hidden group/thumb cursor-pointer"
                      onClick={(e) => {
                        if (post.type === "Bilete") {
                          e.stopPropagation()
                          setSelectedGalleryImage(i)
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
            {post.type === "Bilete" && (
              <>
                <time className="block sm:hidden text-sm text-muted-foreground mb-2 lowercase">
                  <span className="font-extrabold">{day}.</span> {month}
                </time>
                {renderTags()}
              </>
            )}

            {/* Hidden Gallery Trigger for "Bilete" */}
            {post.type === "Bilete" && (
              <div className="hidden">
                <ImageGallery
                  images={post.thumbnails || []}
                  initialIndex={selectedGalleryImage}
                  onIndexChange={setSelectedGalleryImage}
                  syncHash
                />
              </div>
            )}

            {/* Expanded Content */}
            <AnimatePresence initial={false}>
              {isExpanded && post.type !== "Bilete" && post.type !== "Lenkje" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ height: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }, opacity: { duration: 0.2 } }}
                  className="overflow-hidden mt-4 border-t border-gray-100 dark:border-gray-800 pt-6"
                >
                  <div 
                    className="prose dark:prose-invert max-w-none text-base leading-relaxed overflow-hidden break-words"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {post.type === "Interaktiv" ? (
                      <HtmlIframe content={post.content} />
                    ) : post.type === "Bilete" ? (
                      <ImageGallery images={post.thumbnails || []} />
                    ) : (
                      <>
                        {post.type === "Bok" && bookCover && (
                          <div className="mb-8 flex justify-start">
                            <div className="relative w-40 sm:w-48 aspect-[2/3] shadow-xl rounded-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                              <NextImage
                                src={bookCover}
                                alt={`Omslag for ${post.title}`}
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            </div>
                          </div>
                        )}
                        {serializedContent ? (
                          <MDXRemote
                            {...serializedContent}
                            components={{
                              ...mdxComponents,
                              WebDesignKeys
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-center p-4 text-muted-foreground italic">
                            Lastar innhald...
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.article>
        </div>
      </div>
    </div>
  )
}
