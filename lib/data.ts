import { promises as fs } from 'fs'
import path from 'path'
import matter from 'gray-matter'

export interface Build {
  title: string
  slug: string
  date: string
  description: string
  image?: string
  featured?: boolean
  content: string
}

export async function fetchBuilds(): Promise<Build[]> {
  const buildsDirectory = path.join(process.cwd(), 'content', 'builds')
  const files = await fs.readdir(buildsDirectory)
  const markdownFiles = files.filter(file => file.endsWith('.mdx') || file.endsWith('.md'))

  const builds = await Promise.all(
    markdownFiles.map(async file => {
      const filePath = path.join(buildsDirectory, file)
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const { data, content } = matter(fileContent)
      return {
        ...data,
        content,
        slug: file.replace(/\.mdx?$/, ''),
      } as Build
    })
  )

  return builds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function fetchBuildBySlug(slug: string): Promise<Build | null> {
  const builds = await fetchBuilds()
  return builds.find(build => build.slug === slug) || null
}

export async function fetchAllBuildSlugs(): Promise<string[]> {
  const builds = await fetchBuilds()
  return builds.map(build => build.slug)
}