import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { revalidatePath } from 'next/cache'

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  revalidateTag('posts')
  revalidatePath('/', 'layout')

  return NextResponse.json({
    revalidated: true,
    timestamp: new Date().toISOString()
  })
}
