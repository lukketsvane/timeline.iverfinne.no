import { Octokit } from "@octokit/rest"

const octokit = new Octokit({ 
  auth: process.env.NEXT_PUBLIC_GITHUB_PAT || process.env.GITHUB_PAT 
})

export async function fetchProjects() {
  try {
    const [projectsData, writingData] = await Promise.all([
      octokit.repos.getContent({
        owner: 'lukketsvane',
        repo: 'personal-web',
        path: 'projects'
      }),
      octokit.repos.getContent({
        owner: 'lukketsvane',
        repo: 'personal-web',
        path: 'writing'
      })
    ])

    const allFiles = [
      ...Array.isArray(projectsData.data) ? projectsData.data : [],
      ...Array.isArray(writingData.data) ? writingData.data : []
    ].filter(file => file.type === 'file' && file.name.endsWith('.mdx'))

    const projectsContent = await Promise.all(
      allFiles.map(async (file) => {
        const { data } = await octokit.repos.getContent({
          owner: 'lukketsvane',
          repo: 'personal-web',
          path: file.path,
        })

        if ('content' in data) {
          const content = Buffer.from(data.content, 'base64').toString()
          const frontMatterRegex = /---\s*([\s\S]*?)\s*---/
          const frontMatterMatch = content.match(frontMatterRegex)
          const frontMatter = frontMatterMatch ? frontMatterMatch[1] : ''
          const mdContent = content.replace(frontMatterRegex, '').trim()

          const frontMatterObj = frontMatter.split('\n').reduce((acc, line) => {
            const [key, value] = line.split(':').map(str => str.trim())
            if (key && value) {
              acc[key] = value.replace(/^['"](.*)['"]$/, '$1')
            }
            return acc
          }, {} as Record<string, string>)

          const imagePaths = await fetchImagePaths(file.path.split('/')[0])
          const slug = file.name.replace('.mdx', '')

          return {
            title: frontMatterObj.title || slug,
            description: frontMatterObj.description || '',
            date: frontMatterObj.date || new Date().toISOString().split('T')[0],
            tags: frontMatterObj.tags ? frontMatterObj.tags.split(',').map(tag => tag.trim()) : [],
            type: file.path.startsWith('projects/') ? 'project' : 'writing',
            category: frontMatterObj.category || file.path.split('/')[0],
            content: mdContent,
            slug,
            imagePaths,
            url: frontMatterObj.url || '',
            route: `/${slug}`
          }
        }
      })
    )

    return projectsContent.filter(Boolean)
  } catch (error) {
    console.error('Error fetching projects:', error)
    throw error
  }
}

async function fetchImagePaths(projectName: string) {
  try {
    const { data } = await octokit.repos.getContent({
      owner: 'lukketsvane',
      repo: 'personal-web',
      path: `images/${projectName}`
    })

    if (Array.isArray(data)) {
      return data
        .filter(file => file.type === 'file' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name))
        .map(file => file.download_url)
    }
    return []
  } catch (error) {
    console.error(`Error fetching images for ${projectName}:`, error)
    return []
  }
} 