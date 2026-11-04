import type * as lark from '@larksuiteoapi/node-sdk';
import { createCachedSource } from './cache.js';
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
  const onWarnings = opts.onWarnings ?? (() => {});
  return createCachedSource(
    async () => {
      const { entries, warnings } = parseRecords(await opts.fetchAll());
      onWarnings(warnings);
      return entries;
    },
    {
      ttlMs: opts.ttlMs,
      now: opts.now,
      maxWaitMs: opts.maxWaitMs,
      onError: opts.onError,
      makeError: (cause) => new CatalogUnavailableError('目录暂不可用', { cause }),
    },
  );
}

/** Reads every record of a Base table, following pagination (page_size 500). */
export function baseFetcher(
  client: lark.Client,
  appToken: string,
  tableId: string,
): () => Promise<RawRecord[]> {
  return async () => {
    const out: RawRecord[] = [];
    let pageToken: string | undefined;
    do {
      const res = await client.bitable.v1.appTableRecord.list({
        path: { app_token: appToken, table_id: tableId },
        params: { page_size: 500, page_token: pageToken },
      });
      if (res.code !== undefined && res.code !== 0) {
        throw new Error(`读取目录多维表格失败:code=${res.code} msg=${res.msg ?? ''}`);
      }
      for (const item of res.data?.items ?? []) {
        out.push({ record_id: item.record_id ?? '', fields: item.fields as Record<string, unknown> });
      }
      pageToken = res.data?.has_more ? res.data.page_token : undefined;
    } while (pageToken);
    return out;
  };
}
