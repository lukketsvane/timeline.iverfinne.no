'use client'

import { useEffect } from 'react'
import { usePosts } from '@/lib/posts-context'
import MDXBlog from './mdx-blog'

export default function HomePage({
  initialPosts,
  initialView,
}: {
  initialPosts: any[]
  initialView?: 'timeline' | 'gallery' | 'om' | '404'
}) {
  const { setPosts } = usePosts()

  useEffect(() => {
    setPosts(initialPosts)
  }, [initialPosts, setPosts])

  return <MDXBlog initialPosts={initialPosts} initialView={initialView} />
}
