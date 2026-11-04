import { describe, it, expect, vi } from 'vitest';
import { createCatalogSource, CatalogUnavailableError } from '../../src/catalog/source.js';
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
});
