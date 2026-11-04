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
 * - If no fetch has ever succeeded, a failure throws CatalogUnavailableError.
 * - `onWarnings` receives parse warnings after each successful fetch (default: no-op).
 */
export function createCatalogSource(opts: {
  fetchAll: () => Promise<RawRecord[]>;
  ttlMs: number;
  now?: () => number;
  onWarnings?: (warnings: string[]) => void;
}): CatalogSource {
  const now = opts.now ?? Date.now;
  const onWarnings = opts.onWarnings ?? (() => {});
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
      return inflight;
    },
  };
}
