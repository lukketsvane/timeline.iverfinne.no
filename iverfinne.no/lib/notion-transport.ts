// One queue per server instance, shared by the SDK, notion-to-md and images.
// Not a distributed rate limiter: independent instances can still get 429s.
// Respect their cooldown and let the data cache retain its last good result.
type TransportOptions = {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  intervalMs?: number;
  budgetMs?: number;
  queueCeilingMs?: number;
  maxRetries?: number;
};

export function retryAfterMs(value: string | null, now: number): number {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

export function createNotionFetch(options: TransportOptions = {}): typeof fetch {
  const send = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms) => new Promise(resolve => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const interval = options.intervalMs ?? 400;
  const budget = options.budgetMs ?? 20_000;
  const queueCeiling = options.queueCeilingMs ?? Math.max(budget, 50_000);
  const retries = options.maxRetries ?? 3;
  let nextStart = 0;
  let cooldownUntil = 0;
  let queue: Promise<void> = Promise.resolve();

  async function run(input: Parameters<typeof fetch>[0], init: RequestInit | undefined, deadline: number): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const wait = Math.max(nextStart, cooldownUntil) - now();
      if (now() + Math.max(0, wait) >= deadline) {
        // Never shorten Retry-After to squeeze a retry into a function budget.
        return new Response(JSON.stringify({ code: 'rate_limited', message: 'Notion cooldown active' }), {
          status: 429,
          headers: { 'content-type': 'application/json', 'retry-after': String(Math.max(1, Math.ceil(wait / 1000))) },
        });
      }
      if (wait > 0) await sleep(wait);
      init?.signal?.throwIfAborted();
      nextStart = now() + interval;
      try {
        const timeout = AbortSignal.timeout(Math.max(1, deadline - now()));
        const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
        const response = await send(input, { ...init, signal });
        const transient = response.status === 429 || [500, 502, 503, 504].includes(response.status);
        if (!transient) return response;

        const backoff = 1000 * 2 ** attempt + Math.floor(random() * 250);
        const delay = Math.max(retryAfterMs(response.headers.get('retry-after'), now()), backoff);
        cooldownUntil = Math.max(cooldownUntil, now() + delay);
        if (attempt >= retries || cooldownUntil >= deadline) return response;
        await response.body?.cancel();
      } catch (error) {
        if (init?.signal?.aborted || attempt >= retries || now() >= deadline) throw error;
        const delay = 1000 * 2 ** attempt + Math.floor(random() * 250);
        if (now() + delay >= deadline) throw error;
        cooldownUntil = Math.max(cooldownUntil, now() + delay);
      }
    }
  }

  return (input, init) => {
    // Two clocks, because they bound different things. The budget covers this
    // request's own waiting — a shared cooldown, its retries — and starts when
    // the request reaches the head of the queue, so a request is never doomed
    // by the pacing of the ones ahead of it. The ceiling runs from the moment
    // it was queued and caps the total, so a long fan-out still cannot keep a
    // serverless function alive past its limit.
    const ceiling = now() + queueCeiling;
    const result = queue.then(() => run(input, init, Math.min(now() + budget, ceiling)));
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
}
