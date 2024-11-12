import { Octokit } from '@octokit/rest'

const octokit = new Octokit({ 
  auth: process.env.GITHUB_PAT 
})

export interface Project {
  title: string
  description: string
  date: string
  tags: string[]
  slug: string
  content: string
  type: string
  category: string
}

export async function fetchProjects(): Promise<Project[]> {
  try {
    const { data: projectsData } = await octokit.repos.getContent({
      owner: 'lukketsvane',
      repo: 'personal-web',
      path: 'projects'
    })

    if (!Array.isArray(projectsData)) {
      throw new Error('Unexpected response format from GitHub API')
    }

    const projects = await Promise.all(
      projectsData
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
              type: 'project',
              category: frontMatterObj.category || 'project'
            }
          }
          return null
        })
    )

    return projects.filter((project): project is Project => project !== null)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return []
  }
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const projects = await fetchProjects()
  return projects.find(project => project.slug === slug) || null
}