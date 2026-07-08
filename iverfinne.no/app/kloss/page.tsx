import GamePage from '@/components/game-page'

export const revalidate = 60

export const metadata = {
  title: 'kl.oss',
  description: 'kl.oss — eit lite klossespel.',
}

export default function KlossPage() {
  return <GamePage game="kloss" />
}
