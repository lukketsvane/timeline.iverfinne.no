import { NextRequest } from 'next/server'
import { getStolarData, summarizeForResearch } from '@/lib/stolar'
import { FORMLAERE_SYSTEM_PROMPT } from '@/lib/formlaere'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body: { query: string }
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { query } = body
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'Missing or empty "query" field' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (query.length > 2000) {
    return new Response(
      JSON.stringify({ error: 'Query too long (max 2000 characters)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const stolarData = await getStolarData()
    const summary = summarizeForResearch(stolarData.chairs)

    const userMessage = `Her er ein oversikt over databasen:

${summary}

Databasen inneheld totalt ${stolarData.total} stolar, ${stolarData.with_3d} med 3D-modellar, ${stolarData.with_bguw} med bakgrunnsfjerna bilete.

---

Forskingsspørsmål: ${query.trim()}`

    const claudeResponse = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: FORMLAERE_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
          stream: true,
        }),
      }
    )

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text()
      console.error('Claude API error:', claudeResponse.status, errorText)
      return new Response(
        JSON.stringify({
          error: 'Research API request failed',
          status: claudeResponse.status,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Stream the response back
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const reader = claudeResponse.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') continue
                try {
                  const parsed = JSON.parse(data)
                  if (
                    parsed.type === 'content_block_delta' &&
                    parsed.delta?.text
                  ) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`
                      )
                    )
                  }
                } catch {
                  // skip non-JSON lines
                }
              }
            }
          }
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('Research API error:', message)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
