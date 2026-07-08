import HomePage from '@/components/home-page'
import { getPublishedPosts } from '@/lib/notion'

export const revalidate = 60

// A mistyped URL lands inside the app — same single page, full top nav — with
// the hidden "404" tab revealed (and the block game running there). Posts are
// loaded so the other tabs work too; if Notion is unreachable we still render
// the shell so the game tab is available.
export default async function NotFound() {
  let posts: any[] = []
  try {
    posts = await getPublishedPosts()
  } catch {
    posts = []
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-2 py-8 sm:px-4 overflow-x-hidden">
      <HomePage initialPosts={JSON.parse(JSON.stringify(posts))} initialView="404" />
    </div>
  )
}
