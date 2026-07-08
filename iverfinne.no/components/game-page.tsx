import HomePage from '@/components/home-page'
import { getPublishedPosts } from '@/lib/notion'
import type { GameKey } from '@/components/mdx-blog'

// Shared shell for the /404-blokk and /404-kloss routes: the normal app (full top nav)
// with the 404 tab revealed and pinned to the named game. Posts are loaded so
// the other tabs work too; if Notion is unreachable we still render the shell
// so the game is playable.
export default async function GamePage({ game }: { game: GameKey }) {
  let posts: any[] = []
  try {
    posts = await getPublishedPosts()
  } catch {
    posts = []
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-2 py-8 sm:px-4 overflow-x-hidden">
      <HomePage initialPosts={JSON.parse(JSON.stringify(posts))} initialView="404" initialGame={game} />
    </div>
  )
}
