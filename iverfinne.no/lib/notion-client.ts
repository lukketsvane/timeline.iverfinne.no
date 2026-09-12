import { Client } from '@notionhq/client';
import { createNotionFetch } from './notion-transport';

export const NOTION_CACHE_TAG = 'notion-content';
export const NOTION_REFRESH_SECONDS = 300;

// Initial prerendering has no cached fallback and can wait through Notion's
// minute-long cooldowns. Visitor requests retain the short retry budget.
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

export const notion = new Client({
  auth: process.env.NOTION_API_KEY,
  timeoutMs: isBuild ? 185_000 : 60_000,
  fetch: createNotionFetch({
    budgetMs: isBuild ? 180_000 : 20_000,
    intervalMs: isBuild ? 500 : 400,
  }) as NonNullable<ConstructorParameters<typeof Client>[0]>['fetch'],
});

// Keep pagination atomic: a failed later page must fail the refresh, never
// replace the cached complete list with only the first 100 records.
export async function queryAllPages(args: Parameters<typeof notion.databases.query>[0]) {
  const results: Awaited<ReturnType<typeof notion.databases.query>>['results'] = [];
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const response = await notion.databases.query({ ...args, page_size: 100, start_cursor: cursor });
    results.push(...response.results);
    if (!response.has_more) break;
    if (!response.next_cursor || seen.has(response.next_cursor)) throw new Error('Invalid Notion pagination cursor');
    seen.add(response.next_cursor);
    cursor = response.next_cursor;
  } while (cursor);
  return { results };
}
