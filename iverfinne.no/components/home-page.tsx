'use client'

import { useEffect } from 'react'
import { usePosts } from '@/lib/posts-context'
import MDXBlog from './mdx-blog'

export default function HomePage({ initialPosts }: { initialPosts: any[] }) {
  const { setPosts } = usePosts()

  useEffect(() => {
    setPosts(initialPosts)
  }, [initialPosts, setPosts])

  return <MDXBlog initialPosts={initialPosts} />
}
