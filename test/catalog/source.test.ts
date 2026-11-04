import { describe, it, expect, vi } from 'vitest';
import { createCatalogSource, CatalogUnavailableError, baseFetcher } from '../../src/catalog/source.js';
import type { RawRecord } from '../../src/catalog/types.js';

const rec = (name: string): RawRecord => ({
  record_id: name,
  fields: { 名称: name, 类型: '数字员工', 一句话简介: 'x', 上架: true, 跳转链接: { link: 'https://example.com' } },
});

describe('createCatalogSource', () => {
  it('serves cached entries within ttl without refetching', async () => {
    const fetchAll = vi.fn(async () => [rec('a')]);
    let t = 0;
    const s = createCatalogSource({ fetchAll, ttlMs: 60_000, now: () => t });
    await s.get();
    t = 59_000;
    await s.get();
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  it('refetches after ttl', async () => {
    const fetchAll = vi.fn(async () => [rec('a')]);
    let t = 0;
    const s = createCatalogSource({ fetchAll, ttlMs: 60_000, now: () => t });
    await s.get();
    t = 60_001;
    await s.get();
    expect(fetchAll).toHaveBeenCalledTimes(2);
  });

  it('concurrent gets share one in-flight fetch', async () => {
    const fetchAll = vi.fn(async () => [rec('a')]);
    const s = createCatalogSource({ fetchAll, ttlMs: 60_000 });
    await Promise.all([s.get(), s.get(), s.get()]);
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  it('returns last good entries when a refetch fails', async () => {
    const fetchAll = vi.fn<() => Promise<RawRecord[]>>().mockResolvedValueOnce([rec('a')]).mockRejectedValueOnce(new Error('boom'));
    let t = 0;
    const s = createCatalogSource({ fetchAll, ttlMs: 60_000, now: () => t });
    const first = await s.get();
    t = 61_000;
    const second = await s.get();
    expect(second).toEqual(first);
    expect(second.length).toBeGreaterThan(0);
  });

  it('throws CatalogUnavailableError when the first fetch fails', async () => {
    const s = createCatalogSource({ fetchAll: async () => { throw new Error('boom'); }, ttlMs: 60_000 });
    await expect(s.get()).rejects.toBeInstanceOf(CatalogUnavailableError);
  });

  it('retries on the next get after a failed refetch', async () => {
    const fetchAll = vi.fn<() => Promise<RawRecord[]>>()
      .mockResolvedValueOnce([rec('a')])
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([rec('b')]);
    let t = 0;
    const s = createCatalogSource({ fetchAll, ttlMs: 60_000, now: () => t });
    const first = await s.get();
    t = 61_000;
    expect(await s.get()).toEqual(first);
    const third = await s.get();
    expect(fetchAll).toHaveBeenCalledTimes(3);
    expect(third[0].name).toBe('b');
  });

  it('calls onWarnings with parse warnings after a successful fetch', async () => {
    const noLink = { record_id: 'x', fields: { 名称: 'x', 类型: '数字员工', 上架: true } } as RawRecord;
    const onWarnings = vi.fn();
    const s = createCatalogSource({ fetchAll: async () => [noLink], ttlMs: 60_000, onWarnings });
    await s.get();
    expect(onWarnings).toHaveBeenCalledTimes(1);
    expect(onWarnings.mock.calls[0][0]).toHaveLength(1);
    expect(onWarnings.mock.calls[0][0][0]).toContain('x');
  });

  it('a failed first fetch is not cached: the next get retries and succeeds', async () => {
    const fetchAll = vi.fn<() => Promise<RawRecord[]>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([rec('a')]);
    const s = createCatalogSource({ fetchAll, ttlMs: 60_000 });
    await expect(s.get()).rejects.toBeInstanceOf(CatalogUnavailableError);
    expect(await s.get()).toHaveLength(1);
    expect(fetchAll).toHaveBeenCalledTimes(2);
  });

  it('a failure during a shared in-flight fetch rejects all concurrent callers', async () => {
    const fetchAll = vi.fn(async (): Promise<RawRecord[]> => { throw new Error('boom'); });
    const s = createCatalogSource({ fetchAll, ttlMs: 60_000 });
    const results = await Promise.allSettled([s.get(), s.get(), s.get()]);
    for (const r of results) {
      expect(r.status).toBe('rejected');
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(CatalogUnavailableError);
    }
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  it('returns stale entries when a refresh exceeds maxWaitMs, and the background refresh later updates the cache', async () => {
    vi.useFakeTimers();
    try {
      let release!: (r: RawRecord[]) => void;
      const fetchAll = vi.fn<() => Promise<RawRecord[]>>()
        .mockResolvedValueOnce([rec('a')])
        .mockImplementationOnce(() => new Promise<RawRecord[]>((res) => { release = res; }));
      let t = 0;
      const s = createCatalogSource({ fetchAll, ttlMs: 60_000, now: () => t, maxWaitMs: 800 });
      const first = await s.get();
      t = 61_000;
      const pending = s.get();
      await vi.advanceTimersByTimeAsync(800);
      expect(await pending).toEqual(first);
      release([rec('b')]);
      await vi.advanceTimersByTimeAsync(0);
      const later = await s.get();
      expect(later[0].name).toBe('b');
      expect(fetchAll).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('calls onError when a refetch fails, including a late background failure', async () => {
    vi.useFakeTimers();
    try {
      let fail!: (e: Error) => void;
      const fetchAll = vi.fn<() => Promise<RawRecord[]>>()
        .mockResolvedValueOnce([rec('a')])
        .mockRejectedValueOnce(new Error('quick'))
        .mockImplementationOnce(() => new Promise<RawRecord[]>((_, rej) => { fail = rej; }));
      let t = 0;
      const onError = vi.fn();
      const s = createCatalogSource({ fetchAll, ttlMs: 60_000, now: () => t, maxWaitMs: 800, onError });
      await s.get();
      t = 61_000;
      await s.get();
      expect(onError).toHaveBeenCalledTimes(1);
      const pending = s.get();
      await vi.advanceTimersByTimeAsync(800);
      await pending;
      fail(new Error('late'));
      await vi.advanceTimersByTimeAsync(0);
      expect(onError).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('baseFetcher', () => {
  const item = (id: string) => ({ record_id: id, fields: { 名称: id } });
  const fakeClient = (list: ReturnType<typeof vi.fn>) =>
    ({ bitable: { v1: { appTableRecord: { list } } } }) as unknown as Parameters<typeof baseFetcher>[0];

  it('follows page_token until has_more is false and concatenates pages', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ code: 0, data: { items: [item('a'), item('b')], has_more: true, page_token: 'p2' } })
      .mockResolvedValueOnce({ code: 0, data: { items: [item('c')], has_more: false } });
    const out = await baseFetcher(fakeClient(list), 'app1', 'tbl1')();
    expect(out).toEqual([item('a'), item('b'), item('c')]);
    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[0][0]).toEqual({
      path: { app_token: 'app1', table_id: 'tbl1' },
      params: { page_size: 500, page_token: undefined },
    });
    expect(list.mock.calls[1][0].params).toEqual({ page_size: 500, page_token: 'p2' });
  });

  it('handles an empty table', async () => {
    const list = vi.fn().mockResolvedValue({ code: 0, data: { has_more: false } });
    expect(await baseFetcher(fakeClient(list), 'a', 't')()).toEqual([]);
  });

  it('throws on a non-zero code', async () => {
    const list = vi.fn().mockResolvedValue({ code: 1254003, msg: 'bad' });
    await expect(baseFetcher(fakeClient(list), 'a', 't')()).rejects.toThrow(/1254003/);
  });
});
