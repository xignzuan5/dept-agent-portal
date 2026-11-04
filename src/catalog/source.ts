import { parseRecords } from './parse.js';
import type { CatalogEntry, RawRecord } from './types.js';

export class CatalogUnavailableError extends Error {
  constructor(message = '目录暂不可用', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CatalogUnavailableError';
  }
}

export interface CatalogSource {
  get(): Promise<CatalogEntry[]>;
}

/**
 * TTL-cached catalog reader.
 * - Concurrent get()s share one in-flight fetch.
 * - Once a fetch has succeeded, a failed refetch returns the last good entries
 *   (no throw) and leaves the cache expired, so the very next get() retries
 *   instead of serving stale data for another full TTL.
 * - If no fetch has ever succeeded, a failure throws CatalogUnavailableError
 *   (to all concurrent callers) and nothing is cached, so the next get() retries.
 * - Bounded wait: when stale entries exist and the refresh takes longer than
 *   `maxWaitMs` (default 800), get() returns the stale entries immediately; the
 *   refresh keeps running and updates the cache for later callers. With no
 *   cached data, get() waits for the fetch.
 * - `onWarnings` receives parse warnings after each successful fetch; `onError`
 *   receives every fetch failure (including late background ones). Both default
 *   to no-ops. A background refresh never rejects (no unhandled rejections).
 */
export function createCatalogSource(opts: {
  fetchAll: () => Promise<RawRecord[]>;
  ttlMs: number;
  now?: () => number;
  maxWaitMs?: number;
  onWarnings?: (warnings: string[]) => void;
  onError?: (err: unknown) => void;
}): CatalogSource {
  const now = opts.now ?? Date.now;
  const maxWaitMs = opts.maxWaitMs ?? 800;
  const onWarnings = opts.onWarnings ?? (() => {});
  const onError = opts.onError ?? (() => {});
  let cached: CatalogEntry[] | null = null;
  let fetchedAt = 0;
  let inflight: Promise<CatalogEntry[]> | null = null;

  async function refresh(): Promise<CatalogEntry[]> {
    try {
      const { entries, warnings } = parseRecords(await opts.fetchAll());
      cached = entries;
      fetchedAt = now();
      onWarnings(warnings);
      return entries;
    } catch (err) {
      onError(err);
      if (cached) return cached; // fetchedAt untouched => still expired => retry next get()
      throw new CatalogUnavailableError('目录暂不可用', { cause: err });
    }
  }

  return {
    async get() {
      if (cached && now() - fetchedAt < opts.ttlMs) return cached;
      inflight ??= refresh().finally(() => {
        inflight = null;
      });
      const p = inflight;
      const stale = cached;
      if (!stale) return p; // no cached data: must wait (rejection handled by callers)
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<CatalogEntry[]>((resolve) => {
        timer = setTimeout(() => resolve(stale), maxWaitMs);
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
