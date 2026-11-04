/**
 * Generic TTL cache around an async loader (shared by the catalog and promo sources).
 * - Concurrent get()s share one in-flight load.
 * - Once a load has succeeded, a failed reload returns the last good value (no
 *   throw) and leaves the cache expired, so the very next get() retries.
 * - If no load has ever succeeded, a failure throws `makeError(cause)` (to all
 *   concurrent callers) and nothing is cached, so the next get() retries.
 * - Bounded wait: with a stale value and a reload slower than `maxWaitMs`
 *   (default 800), get() returns the stale value immediately; the reload keeps
 *   running and updates the cache for later callers. With no cached value,
 *   get() waits for the load.
 * - `onError` receives every load failure (including late background ones). A
 *   background reload never rejects (no unhandled rejections).
 */
export function createCachedSource<T>(
  load: () => Promise<T>,
  opts: {
    ttlMs: number;
    now?: () => number;
    maxWaitMs?: number;
    onError?: (err: unknown) => void;
    makeError: (cause: unknown) => Error;
  },
): { get(): Promise<T> } {
  const now = opts.now ?? Date.now;
  const maxWaitMs = opts.maxWaitMs ?? 800;
  const onError = opts.onError ?? (() => {});
  let cached: { value: T } | null = null;
  let fetchedAt = 0;
  let inflight: Promise<T> | null = null;

  async function refresh(): Promise<T> {
    try {
      const value = await load();
      cached = { value };
      fetchedAt = now();
      return value;
    } catch (err) {
      onError(err);
      if (cached) return cached.value; // fetchedAt untouched => still expired => retry next get()
      throw opts.makeError(err);
    }
  }

  return {
    async get() {
      if (cached && now() - fetchedAt < opts.ttlMs) return cached.value;
      inflight ??= refresh().finally(() => {
        inflight = null;
      });
      const p = inflight;
      const stale = cached;
      if (!stale) return p; // no cached data: must wait (rejection handled by callers)
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(stale.value), maxWaitMs);
      });
      try {
        // p never rejects here: refresh() returns cached when cached is set.
        return await Promise.race([p, timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
