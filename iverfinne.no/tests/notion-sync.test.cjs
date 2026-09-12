const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Compile the actual TS modules with only their network/cache boundaries
// substituted. Tests cannot contact the live workspace or publish content.
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const mod = new Module(filename, module);
  mod.paths = module.paths;
  mod.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  mod._compile(output, filename);
  return mod.exports;
}
const { createNotionFetch, retryAfterMs } = load('lib/notion-transport.ts');
function transport(responses, extra = {}) {
  let clock = 0;
  const calls = [];
  const send = createNotionFetch({
    now: () => clock, sleep: async ms => { clock += ms; }, random: () => 0,
    fetch: async (...args) => {
      calls.push({ at: clock, args });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      assert.ok(response, 'unexpected extra request');
      return response;
    }, ...extra,
  });
  return { send, calls };
}
const ok = () => Response.json({ ok: true });

test('build client waits through a one-minute cooldown; runtime stays bounded', async () => {
  const savedPhase = process.env.NEXT_PHASE;
  try {
    for (const build of [true, false]) {
      if (build) process.env.NEXT_PHASE = 'phase-production-build';
      else delete process.env.NEXT_PHASE;
      let clientOptions;
      let harness;
      load('lib/notion-client.ts', {
        '@notionhq/client': { Client: class { constructor(options) { clientOptions = options; } } },
        './notion-transport': { createNotionFetch: options => {
          harness = transport([new Response('', { status: 429, headers: { 'Retry-After': '60' } }), ok()], options);
          return harness.send;
        } },
      });
      const response = await clientOptions.fetch('https://api.notion.com/v1/pages/a');
      assert.equal(response.status, build ? 200 : 429);
      assert.deepEqual(harness.calls.map(call => call.at), build ? [0, 60000] : [0]);
      assert.equal(clientOptions.timeoutMs, build ? 185000 : 60000);
    }
  } finally {
    if (savedPhase === undefined) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = savedPhase;
  }
});

test('concurrent SDK calls are paced, not burst-fired', async () => {
  const { send, calls } = transport([ok(), ok(), ok(), ok()]);
  await Promise.all(Array.from({ length: 4 }, () => send('https://api.notion.com/v1/pages/test')));
  assert.deepEqual(calls.map(c => c.at), [0, 400, 800, 1200]);
});
test('429 respects Retry-After before retrying the same request', async () => {
  const { send, calls } = transport([new Response('', { status: 429, headers: { 'Retry-After': '7' } }), ok()]);
  assert.equal((await send('https://api.notion.com/v1/databases/test/query', { method: 'POST', body: '{"page_size":100}' })).status, 200);
  assert.deepEqual(calls.map(c => c.at), [0, 7000]);
  assert.equal(calls[0].args[1].body, calls[1].args[1].body);
});
test('long Retry-After is never capped; queued requests share the cooldown', async () => {
  const { send, calls } = transport([new Response('', { status: 429, headers: { 'Retry-After': '120' } })]);
  assert.equal((await send('https://api.notion.com/v1/pages/a')).status, 429);
  assert.equal((await send('https://api.notion.com/v1/pages/b')).status, 429);
  assert.equal(calls.length, 1);
});
test('queue pacing alone never synthesizes a cooldown', async () => {
  // Four requests, paced 400ms apart, against a 1s budget: the last one only
  // reaches the head of the queue at 1200ms. Charging that wait to its own
  // budget used to fail it before it was ever sent, which is how one slow
  // fan-out turned into an "Application error" page.
  const { send, calls } = transport([ok(), ok(), ok(), ok()], { budgetMs: 1000 });
  const statuses = await Promise.all(Array.from({ length: 4 }, () => send('https://api.notion.com/v1/pages/test')));
  assert.deepEqual(statuses.map(r => r.status), [200, 200, 200, 200]);
  assert.deepEqual(calls.map(c => c.at), [0, 400, 800, 1200]);
});
test('the queue ceiling still bounds a request that waits too long to start', async () => {
  const { send, calls } = transport([ok(), ok()], { budgetMs: 5000, queueCeilingMs: 500 });
  const statuses = await Promise.all(Array.from({ length: 3 }, () => send('https://api.notion.com/v1/pages/test')));
  assert.deepEqual(statuses.map(r => r.status), [200, 200, 429]);
  assert.equal(calls.length, 2);
});
test('Retry-After accepts HTTP dates and rejects invalid values', () => {
  assert.equal(retryAfterMs('Thu, 01 Jan 1970 00:00:12 GMT', 2000), 10000);
  assert.equal(retryAfterMs('bad', 0), 0);
});
test('503 and network errors retry; auth failures do not', async () => {
  const retry = transport([new Response('', { status: 503 }), new TypeError('network unavailable'), ok()]);
  assert.equal((await retry.send('https://api.notion.com/v1/pages/a')).status, 200);
  assert.equal(retry.calls.length, 3);
  const auth = transport([new Response('', { status: 401 }), ok()]);
  assert.equal((await auth.send('https://api.notion.com/v1/pages/a')).status, 401);
  assert.equal((await auth.send('https://api.notion.com/v1/pages/b')).status, 200);
  assert.equal(auth.calls.length, 2);
});
test('persistent failures have a finite retry budget and do not poison the queue', async () => {
  const { send, calls } = transport([new Error('offline'), new Error('offline'), ok()], { maxRetries: 1 });
  await assert.rejects(send('https://api.notion.com/v1/pages/a'), /offline/);
  assert.equal((await send('https://api.notion.com/v1/pages/b')).status, 200);
  assert.equal(calls.length, 3);
});
test('aborted queued requests are not sent', async () => {
  const controller = new AbortController();
  controller.abort();
  const { send, calls } = transport([]);
  await assert.rejects(send('https://api.notion.com/v1/pages/a', { signal: controller.signal }));
  assert.equal(calls.length, 0);
});

test('the real SDK and recursive markdown converter use the protected transport', async () => {
  const { Client } = require('@notionhq/client');
  const { NotionToMarkdown } = require('notion-to-md');
  const text = (content) => [{ type: 'text', plain_text: content, text: { content }, annotations: {} }];
  const { send, calls } = transport([
    Response.json({ results: [{ id: 'parent', type: 'bulleted_list_item', has_children: true, bulleted_list_item: { rich_text: text('Parent') } }], next_cursor: null }),
    new Response('{"code":"rate_limited","message":"wait"}', { status: 429, headers: { 'Retry-After': '2' } }),
    Response.json({ results: [{ id: 'child', type: 'paragraph', has_children: false, paragraph: { rich_text: text('Child') } }], next_cursor: null }),
  ]);
  const notion = new Client({ auth: 'fixture-only', fetch: send });
  const n2m = new NotionToMarkdown({ notionClient: notion });
  const result = n2m.toMarkdownString(await n2m.pageToMarkdown('page'));
  assert.match(result.parent, /Parent/);
  assert.match(result.parent, /Child/);
  assert.equal(calls.length, 3);
  assert.ok(calls[2].at - calls[1].at >= 2000);
});

function clientWith(query) {
  const client = { databases: { query } };
  return load('lib/notion-client.ts', {
    '@notionhq/client': { Client: class { constructor() { return client; } } },
    './notion-transport': { createNotionFetch },
  });
}
test('database pagination includes records after the first 100', async () => {
  const cursors = [];
  const { queryAllPages } = clientWith(async args => {
    cursors.push(args.start_cursor);
    return args.start_cursor
      ? { results: [{ id: '101' }], has_more: false, next_cursor: null }
      : { results: Array.from({ length: 100 }, (_, id) => ({ id: String(id) })), has_more: true, next_cursor: 'next' };
  });
  assert.equal((await queryAllPages({ database_id: 'test' })).results.length, 101);
  assert.deepEqual(cursors, [undefined, 'next']);
});
test('a failed second database page fails the entire refresh', async () => {
  const { queryAllPages } = clientWith(async args => {
    if (args.start_cursor) throw new Error('429 on page two');
    return { results: [{ id: 'first' }], has_more: true, next_cursor: 'next' };
  });
  await assert.rejects(queryAllPages({ database_id: 'test' }), /429 on page two/);
});
test('bad pagination cursors fail instead of silently truncating or looping', async () => {
  const { queryAllPages } = clientWith(async () => ({ results: [], has_more: true, next_cursor: 'same' }));
  await assert.rejects(queryAllPages({ database_id: 'test' }), /cursor/);
});

test('revalidation fails closed without a secret and only marks content stale', () => {
  const calls = [];
  const saved = process.env.REVALIDATION_SECRET;
  try {
    const { validateSecret, refreshNotion } = load('lib/revalidation.ts', {
      'next/cache': { revalidateTag: (...args) => calls.push(args) },
      './notion-client': { NOTION_CACHE_TAG: 'notion-content' },
    });
    delete process.env.REVALIDATION_SECRET;
    assert.equal(validateSecret(undefined), false);
    assert.equal(validateSecret(''), false);
    process.env.REVALIDATION_SECRET = 'fixture-secret';
    assert.equal(validateSecret('wrong'), false);
    assert.equal(validateSecret('fixture-secret'), true);
    refreshNotion();
    assert.deepEqual(calls, [['notion-content', 'max']]);
  } finally {
    if (saved === undefined) delete process.env.REVALIDATION_SECRET;
    else process.env.REVALIDATION_SECRET = saved;
  }
});

function contentLibrary(failBody) {
  const page = id => ({
    id, created_time: '2026-09-12T00:00:00Z', last_edited_time: '2026-09-12T00:00:00Z',
    properties: { Namn: { type: 'title', title: [{ plain_text: id }] }, Type: { select: { name: 'Prosjekt' } } },
  });
  const { NotionToMarkdown } = require('notion-to-md');
  return load('lib/notion.ts', {
    './notion-client': {
      NOTION_CACHE_TAG: 'notion-content', NOTION_REFRESH_SECONDS: 300,
      queryAllPages: async () => ({ results: [page('first'), page('second')] }),
      notion: { blocks: { children: { list: async ({ block_id }) => {
        if (failBody() && block_id === 'second') throw new Error('failed body');
        return { results: [], has_more: false, next_cursor: null };
      } } } },
    },
    'next/cache': { unstable_cache: fn => fn },
    react: { cache: fn => fn },
    'notion-to-md': { NotionToMarkdown },
    'next-mdx-remote/serialize': { serialize: async content => ({ content }) },
    'remark-gfm': () => {}, 'rehype-prism-plus': () => {},
  });
}
test('body failure keeps the last COMPLETE list, including the failed post', async () => {
  const saved = process.env.NOTION_DATABASE_ID;
  const log = console.error;
  try {
    process.env.NOTION_DATABASE_ID = 'fixture';
    console.error = () => {};
    let fail = false;
    const lib = contentLibrary(() => fail);
    const good = await lib.getPublishedPosts();
    assert.equal(good.length, 2);
    fail = true;
    const stale = await lib.getPublishedPosts();
    assert.deepEqual(stale, good);
  } finally {
    console.error = log;
    if (saved === undefined) delete process.env.NOTION_DATABASE_ID;
    else process.env.NOTION_DATABASE_ID = saved;
  }
});
test('a first-ever failed fetch throws instead of publishing empty/partial data', async () => {
  const saved = process.env.NOTION_DATABASE_ID;
  const log = console.error;
  try {
    process.env.NOTION_DATABASE_ID = 'fixture';
    console.error = () => {};
    await assert.rejects(contentLibrary(() => true).getPublishedPosts(), /failed body/);
  } finally {
    console.error = log;
    if (saved === undefined) delete process.env.NOTION_DATABASE_ID;
    else process.env.NOTION_DATABASE_ID = saved;
  }
});
