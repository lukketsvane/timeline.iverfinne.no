import { Octokit } from '@octokit/rest'

const octokit = new Octokit({ 
  auth: process.env.GITHUB_PAT 
})

export interface ContentItem {
  title: string
  description: string
  date: string
  tags: string[]
  slug: string
  content: string
  type: 'project' | 'writing' | 'book' | 'outgoing'
  category: string
  url?: string
  image?: string
  rating?: number
}

async function fetchContentFromGitHub(path: string, type: 'project' | 'writing' | 'book' | 'outgoing'): Promise<ContentItem[]> {
  try {
    console.log(`Fetching ${type}s from GitHub...`);
    const { data: contentData } = await octokit.repos.getContent({
      owner: 'lukketsvane',
      repo: 'personal-web',
      path: path
    })

    if (!Array.isArray(contentData)) {
      throw new Error('Unexpected response format from GitHub API')
    }

    console.log(`Found ${contentData.length} files in ${path}`);

    const content = await Promise.all(
      contentData
        .filter(file => file.type === 'file' && file.name.endsWith('.mdx'))
        .map(async (file) => {
          console.log(`Processing file: ${file.name}`);
          const { data } = await octokit.repos.getContent({
            owner: 'lukketsvane',
            repo: 'personal-web',
            path: file.path,
          })

          if (typeof data === 'object' && 'content' in data && typeof data.content === 'string') {
            const content = Buffer.from(data.content, 'base64').toString()
            const [, frontMatter, mdContent] = content.split('---')
            const frontMatterObj = Object.fromEntries(
              frontMatter.trim().split('\n').map(line => {
                const [key, ...valueParts] = line.split(':')
                return [key.trim(), valueParts.join(':').trim()]
              })
            )

            return {
              title: frontMatterObj.title || file.name.replace('.mdx', ''),
              description: frontMatterObj.description || '',
              date: frontMatterObj.date || new Date().toISOString().split('T')[0],
              tags: frontMatterObj.tags ? frontMatterObj.tags.split(',').map(tag => tag.trim()) : [],
              slug: file.name.replace('.mdx', ''),
              content: mdContent.trim(),
              type: type,
              category: frontMatterObj.category || type,
              image: frontMatterObj.image || '',
              rating: frontMatterObj.rating ? parseFloat(frontMatterObj.rating) : undefined,
            } as ContentItem
          }
          return null
        })
    )

    const validContent = content.filter((item): item is ContentItem => item !== null);
    console.log(`Processed ${validContent.length} valid ${type} items`);
    return validContent;
  } catch (error) {
    console.error(`Error fetching ${type}s:`, error)
    return []
  }
}

export async function fetchProjects(): Promise<ContentItem[]> {
  return fetchContentFromGitHub('projects', 'project')
}

export async function fetchWriting(): Promise<ContentItem[]> {
  console.log('Fetching writing...');
  const writing = await fetchContentFromGitHub('writing', 'writing');
  console.log(`Fetched ${writing.length} writing`);
  return writing;
}

export async function fetchBooks(): Promise<ContentItem[]> {
  return fetchContentFromGitHub('books', 'book')
}

export async function Outgoing(): Promise<ContentItem[]> {
  try {
    const { data: contentData } = await octokit.repos.getContent({
      owner: 'lukketsvane',
      repo: 'personal-web',
      path: 'outgoing'
    })

    if (!Array.isArray(contentData)) {
      throw new Error('Unexpected response format from GitHub API')
    }

    const links = await Promise.all(
      contentData
        .filter(file => file.type === 'file' && file.name.endsWith('.mdx'))
        .map(async (file) => {
          const { data } = await octokit.repos.getContent({
            owner: 'lukketsvane',
            repo: 'personal-web',
            path: file.path,
          })

          if (typeof data === 'object' && 'content' in data && typeof data.content === 'string') {
            const content = Buffer.from(data.content, 'base64').toString()
            const [, frontMatter, mdContent] = content.split('---')
            const frontMatterObj = Object.fromEntries(
              frontMatter.trim().split('\n').map(line => {
                const [key, ...valueParts] = line.split(':')
                return [key.trim(), valueParts.join(':').trim()]
              })
            )

            return {
              title: frontMatterObj.title || file.name.replace('.mdx', ''),
              description: frontMatterObj.description || '',
              date: frontMatterObj.date || new Date().toISOString().split('T')[0],
              tags: frontMatterObj.tags ? frontMatterObj.tags.split(',').map(tag => tag.trim()) : [],
              slug: file.name.replace('.mdx', ''),
              content: mdContent.trim(),
              type: 'outgoing' as const,
              category: frontMatterObj.category || 'outgoing',
              url: frontMatterObj.url || '',
              image: frontMatterObj.image || '',
              rating: frontMatterObj.rating ? parseFloat(frontMatterObj.rating) : undefined,
            } as ContentItem
          }
          return null
        })
    )

    return links.filter((item): item is ContentItem => item !== null)
  } catch (error) {
    console.error('Error fetching outgoing links:', error)
    return []
  }
}

export async function getProjectBySlug(slug: string): Promise<ContentItem | null> {
  const projects = await fetchProjects()
  return projects.find(project => project.slug === slug) || null
}

export async function getWritingBySlug(slug: string): Promise<ContentItem | null> {
  const writing = await fetchWriting()
  return writing.find(writing => writing.slug === slug) || null
}

export async function getBookBySlug(slug: string): Promise<ContentItem | null> {
  const books = await fetchBooks()
  return books.find(book => book.slug === slug) || null
}

export async function getOutgoingLinkBySlug(slug: string): Promise<ContentItem | null> {
  const links = await Outgoing()
  return links.find(link => link.slug === slug) || null
}

export async function fetchAllEntries(): Promise<ContentItem[]> {
  const [projects, writing, books, outgoingLinks] = await Promise.all([
    fetchProjects(),
    fetchWriting(),
    fetchBooks(),
    Outgoing()
  ]);
  return [...projects, ...writing, ...books, ...outgoingLinks];
}

export async function fetchEntryBySlug(slug: string): Promise<ContentItem | null> {
  const allEntries = await fetchAllEntries();
  return allEntries.find(entry => entry.slug === slug) || null;
}

export async function fetchAllSlugs(): Promise<string[]> {
  const allEntries = await fetchAllEntries();
  return allEntries.map(entry => entry.slug);
}