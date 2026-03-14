'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface PostsContextType {
  posts: any[]
  setPosts: (posts: any[]) => void
  getPostByTypeAndSlug: (type: string, slug: string) => any | null
  getPostBySlug: (slug: string) => any | null
}

const PostsContext = createContext<PostsContextType>({
  posts: [],
  setPosts: () => {},
  getPostByTypeAndSlug: () => null,
  getPostBySlug: () => null,
})

export function PostsProvider({ children, initialPosts = [] }: { children: ReactNode; initialPosts?: any[] }) {
  const [posts, setPosts] = useState<any[]>(initialPosts)

  const getPostByTypeAndSlug = useCallback((type: string, slug: string) => {
    return posts.find((p) => p.slug === slug && p.type.toLowerCase() === type.toLowerCase()) || null
  }, [posts])

  const getPostBySlug = useCallback((slug: string) => {
    return posts.find((p) => p.slug === slug) || null
  }, [posts])

  return (
    <PostsContext.Provider value={{ posts, setPosts, getPostByTypeAndSlug, getPostBySlug }}>
      {children}
    </PostsContext.Provider>
  )
}

export function usePosts() {
  return useContext(PostsContext)
}
