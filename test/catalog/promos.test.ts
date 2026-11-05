import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadBannerKeys, parsePromoRecords, createPromoSource } from '../../src/catalog/promos.js';
import type { RawRecord } from '../../src/catalog/types.js';

const rec = (id: string, over: Record<string, unknown> = {}): RawRecord => ({
  record_id: id,
  fields: {
    标题: [{ type: 'text', text: `标题${id}` }],
    说明: '说明',
    跳转链接: { link: 'https://example.com/x', text: 'x' },
    开始时间: 1000,
    结束时间: 2000,
    排序: 3,
    上架: true,
    ...over,
  },
});

describe('loadBannerKeys', () => {
  it('returns nulls for a missing file', () => {
    expect(loadBannerKeys('/nonexistent/banner-keys.json')).toEqual({
      brand: null,
      category: { agent: null, skill: null, kb: null, service: null },
      promoDefault: null,
      icons: { agent: null, skill: null, kb: null, service: null },
    });
  });
  it('reads present fields and nulls missing ones', () => {
    const p = join(mkdtempSync(join(tmpdir(), 'bk-')), 'k.json');
    writeFileSync(p, JSON.stringify({ brand: 'b', category: { agent: 'a', kb: 7 } }));
    expect(loadBannerKeys(p)).toEqual({
      brand: 'b',
      category: { agent: 'a', skill: null, kb: null, service: null },
      promoDefault: null,
      icons: { agent: null, skill: null, kb: null, service: null },
    });
  });
  it('returns null icons when the file has none, and reads icons when present', () => {
    const p = join(mkdtempSync(join(tmpdir(), 'bk-')), 'k.json');
    writeFileSync(p, JSON.stringify({ brand: 'b', category: {}, promoDefault: 'p' }));
    expect(loadBannerKeys(p).icons).toEqual({ agent: null, skill: null, kb: null, service: null });
    writeFileSync(p, JSON.stringify({ icons: { agent: 'ia', skill: 'is', kb: 5 } }));
    expect(loadBannerKeys(p).icons).toEqual({ agent: 'ia', skill: 'is', kb: null, service: null });
  });
  it('returns nulls for invalid JSON', () => {
    const p = join(mkdtempSync(join(tmpdir(), 'bk-')), 'k.json');
    writeFileSync(p, '{oops');
    expect(loadBannerKeys(p).brand).toBeNull();
  });
});

describe('parsePromoRecords', () => {
  it('maps fields, converts dates to ms and skips unlisted/titleless records with warnings', () => {
    const { promos, warnings } = parsePromoRecords([
      rec('a', { 图片: [{ file_token: 'ft1', name: 'x.png' }] }),
      rec('b', { 上架: false }),
      rec('c', { 标题: '  ' }),
      rec('d', { 跳转链接: { link: 'javascript:alert(1)', text: 'x' }, 开始时间: undefined, 排序: undefined }),
    ]);
    expect(promos).toEqual([
      { id: 'a', title: '标题a', subtitle: '说明', link: 'https://example.com/x', imageToken: 'ft1', start: 1000, end: 2000, order: 3 },
      { id: 'd', title: '标题d', subtitle: '说明', link: null, imageToken: null, start: null, end: 2000, order: 9999 },
    ]);
    expect(warnings.some((w) => w.includes('b') && w.includes('未上架'))).toBe(true);
    expect(warnings.some((w) => w.includes('c') && w.includes('标题'))).toBe(true);
    expect(warnings.some((w) => w.includes('d') && w.includes('http'))).toBe(true);
  });
  it('accepts a plain string link and segment-array link', () => {
    const { promos } = parsePromoRecords([
      rec('a', { 跳转链接: 'https://a.com' }),
      rec('b', { 跳转链接: [{ type: 'url', text: 'x', link: 'https://b.com' }] }),
    ]);
    expect(promos.map((p) => p.link)).toEqual(['https://a.com', 'https://b.com']);
  });
});

describe('createPromoSource', () => {
  const withImg = (id: string, token: string) => rec(id, { 图片: [{ file_token: token }] });

  it('resolves each image token once and caches it across refreshes', async () => {
    const resolveImage = vi.fn(async (t: string) => `img_${t}`);
    let t = 0;
    const s = createPromoSource({
      fetchAll: async () => [withImg('a', 'T1'), withImg('b', 'T1'), rec('c')],
      resolveImage,
      ttlMs: 10,
      now: () => t,
    });
    const first = await s.get();
    expect(first.map((p) => p.imgKey)).toEqual(['img_T1', 'img_T1', null]);
    t = 100;
    await s.get();
    expect(resolveImage).toHaveBeenCalledTimes(1);
  });

  it('an image that fails to resolve yields imgKey null and calls onError', async () => {
    const onError = vi.fn();
    const s = createPromoSource({
      fetchAll: async () => [withImg('a', 'BAD'), withImg('b', 'OK')],
      resolveImage: async (tok) => {
        if (tok === 'BAD') throw new Error('boom');
        return 'k_' + tok;
      },
      ttlMs: 1000,
      onError,
    });
    const r = await s.get();
    expect(r.find((p) => p.id === 'a')!.imgKey).toBeNull();
    expect(r.find((p) => p.id === 'b')!.imgKey).toBe('k_OK');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('serves last good data when a refetch fails and throws PromoUnavailableError on first failure', async () => {
    const { PromoUnavailableError } = await import('../../src/catalog/promos.js');
    const bad = createPromoSource({
      fetchAll: async () => {
        throw new Error('down');
      },
      resolveImage: async () => 'k',
      ttlMs: 10,
    });
    await expect(bad.get()).rejects.toBeInstanceOf(PromoUnavailableError);

    let fail = false;
    let t = 0;
    const onError = vi.fn();
    const s = createPromoSource({
      fetchAll: async () => {
        if (fail) throw new Error('down');
        return [rec('a')];
      },
      resolveImage: async () => 'k',
      ttlMs: 10,
      now: () => t,
      onError,
    });
    await s.get();
    fail = true;
    t = 50;
    expect((await s.get()).map((p) => p.id)).toEqual(['a']);
    expect(onError).toHaveBeenCalled();
  });

  it('returns stale data after maxWaitMs while a slow refresh runs', async () => {
    let t = 0;
    let slow = false;
    const s = createPromoSource({
      fetchAll: async () => {
        if (slow) await new Promise((r) => setTimeout(r, 200));
        return [rec(slow ? 'new' : 'old')];
      },
      resolveImage: async () => 'k',
      ttlMs: 10,
      maxWaitMs: 20,
      now: () => t,
    });
    await s.get();
    slow = true;
    t = 50;
    expect((await s.get()).map((p) => p.id)).toEqual(['old']);
  });

  it('a resolveImage that never settles yields imgKey null after imageTimeoutMs and calls onError', async () => {
    const onError = vi.fn();
    const s = createPromoSource({
      fetchAll: async () => [withImg('a', 'T1')],
      resolveImage: () => new Promise<string>(() => {}),
      ttlMs: 10,
      imageTimeoutMs: 20,
      onError,
    });
    expect((await s.get()).map((p) => p.imgKey)).toEqual([null]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toContain('超时');
  });

  it('a timed-out token is retried on the next refresh', async () => {
    let calls = 0;
    let t = 0;
    const s = createPromoSource({
      fetchAll: async () => [withImg('a', 'T1')],
      resolveImage: () => (++calls === 1 ? new Promise<string>(() => {}) : Promise.resolve('img_ok')),
      ttlMs: 10,
      now: () => t,
      imageTimeoutMs: 20,
    });
    expect((await s.get())[0].imgKey).toBeNull();
    t = 100;
    expect((await s.get())[0].imgKey).toBe('img_ok');
    expect(calls).toBe(2);
  });
});
