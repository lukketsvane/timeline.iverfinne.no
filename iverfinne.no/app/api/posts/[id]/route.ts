import { NextResponse } from 'next/server'
import { getPostContent, getSafeScope } from '@/lib/notion'
import { serialize } from 'next-mdx-remote/serialize'
import remarkGfm from 'remark-gfm'

export const revalidate = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id
    const rawContent = await getPostContent(id)

    const serialized = await serialize(rawContent, {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        format: 'mdx',
      },
      scope: getSafeScope(rawContent),
      parseFrontmatter: true,
    })

    return NextResponse.json({ source: serialized })
  } catch (error) {
    console.error('Error fetching/serializing post content:', error)
    return NextResponse.json({ error: 'Failed to process content' }, { status: 500 })
  }
}
