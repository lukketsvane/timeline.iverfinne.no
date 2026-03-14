import HomePage from '@/components/home-page'
import { getPublishedPosts, getPostContent, getSafeScope } from '@/lib/notion'
import { serialize } from 'next-mdx-remote/serialize'
import remarkGfm from 'remark-gfm'

export default async function Home() {
  const posts = await getPublishedPosts()

  const postsWithContent = await Promise.all(posts.map(async (post) => {
    const id = post.id;
    if (!id) return post;

    try {
      const content = await getPostContent(id)
      const serialized = await serialize(content, {
        mdxOptions: {
          remarkPlugins: [remarkGfm],
          format: 'mdx',
        },
        scope: getSafeScope(content)
      })
      return { ...post, content, serialized }
    } catch (e) {
      console.error(`Error pre-serializing post ${post.id}:`, e)
      return post
    }
  }))

  return (
    <div className="container w-screen px-4 py-8">
      <HomePage initialPosts={JSON.parse(JSON.stringify(postsWithContent))} />
    </div>
  )
}
