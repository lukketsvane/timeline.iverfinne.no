import GamePage from '@/components/game-page'

export const revalidate = 60

export const metadata = {
  title: 'bl.okk',
  description: 'bl.okk — eit lite blokkspel.',
}

export default function BlokkPage() {
  return <GamePage game="blokk" />
}
