import { NextResponse } from 'next/server'
import { getSkissebokDrawings } from '@/lib/notion'

// Drawings rarely change — cache for 5 minutes.
export const revalidate = 300

export async function GET() {
  try {
    const drawings = await getSkissebokDrawings()
    return NextResponse.json({ drawings })
  } catch (error) {
    console.error('Error fetching skissebok drawings:', error)
    return NextResponse.json({ drawings: [] })
  }
}
