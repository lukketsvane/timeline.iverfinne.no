'use client'

import { useEffect } from 'react'
import { usePosts } from '@/lib/posts-context'
import MDXBlog, { type GameKey } from './mdx-blog'

export default function HomePage({
  initialPosts,
  initialView,
  initialGame,
}: {
  initialPosts: any[]
  initialView?: 'timeline' | 'gallery' | 'om' | '404'
  initialGame?: GameKey
}) {
  const { setPosts } = usePosts()

  useEffect(() => {
    setPosts(initialPosts)
  }, [initialPosts, setPosts])

  return <MDXBlog initialPosts={initialPosts} initialView={initialView} initialGame={initialGame} />
}
