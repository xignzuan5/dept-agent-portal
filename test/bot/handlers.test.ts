import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeAction } from '../../src/bot/actions.js';
import { handleCardAction, type CardActionInput, type Deliverer, type HandlerDeps } from '../../src/bot/handlers.js';
import { CatalogUnavailableError } from '../../src/catalog/source.js';
import { PAGE_SIZE } from '../../src/cards/portal.js';
import type { CatalogEntry } from '../../src/catalog/types.js';

const dept = { name: '智能平台部', intro: '简介', routerLink: null as string | null };
let n = 0;
const e = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: `r${++n}`, category: 'agent', name: `员工${n}`, summary: '简介', detail: '详情',
  tags: ['t'], ownerOpenIds: [], link: 'https://example.com/x', order: n, hot: false, ...over,
});
const many = (k: number, over: Partial<CatalogEntry> = {}) => Array.from({ length: k }, () => e(over));
const json = (o: unknown) => JSON.stringify(o);

function find(node: unknown, pred: (o: any) => boolean, out: any[] = []): any[] {
  if (Array.isArray(node)) node.forEach((x) => find(x, pred, out));
  else if (node && typeof node === 'object') {
    if (pred(node)) out.push(node);
    Object.values(node).forEach((x) => find(x, pred, out));
  }
  return out;
}

function mk(over: Partial<HandlerDeps> = {}, entries: CatalogEntry[] = many(20)) {
  const personalPortal = vi.fn<Deliverer['personalPortal']>(async () => ({ via: 'ephemeral' as const }));
  const onError = vi.fn();
  const deps: HandlerDeps = {
    catalog: { get: async () => entries },
    dept,
    deliver: { personalPortal },
    onError,
    ...over,
  };
  return { deps, personalPortal, onError };
}
const evt = (value: unknown, over: Partial<CardActionInput> = {}): CardActionInput => ({
  operatorOpenId: 'ou_1', chatId: 'oc_1', chatType: 'group', value, ...over,
});

afterEach(() => vi.useRealTimers());

describe('decodeAction', () => {
  it('accepts object and JSON string', () => {
    expect(decodeAction({ v: 1, a: 'open_portal' })).toEqual({ v: 1, a: 'open_portal' });
    expect(decodeAction(json({ v: 1, a: 'nav', cat: 'kb', page: 2, q: 'x' }))).toEqual({
      v: 1, a: 'nav', cat: 'kb', page: 2, q: 'x',
    });
    expect(decodeAction({ v: 1, a: 'search', cat: 'skill' })).toEqual({ v: 1, a: 'search', cat: 'skill' });
  });
  it('rejects unknown a / bad cat / bad page / bad q / bad v / junk', () => {
    expect(decodeAction({ v: 1, a: 'boom' })).toBeNull();
    expect(decodeAction({ v: 1, a: 'nav', cat: 'zzz', page: 0, q: '' })).toBeNull();
    expect(decodeAction({ v: 1, a: 'nav', cat: 'kb', page: -1, q: '' })).toBeNull();
    expect(decodeAction({ v: 1, a: 'nav', cat: 'kb', page: 1.5, q: '' })).toBeNull();
    expect(decodeAction({ v: 1, a: 'nav', cat: 'kb', page: '1', q: '' })).toBeNull();
    expect(decodeAction({ v: 1, a: 'nav', cat: 'kb', page: 0, q: 5 })).toBeNull();
    expect(decodeAction({ v: 2, a: 'open_portal' })).toBeNull();
    expect(decodeAction('not json')).toBeNull();
    expect(decodeAction(null)).toBeNull();
    expect(decodeAction(42)).toBeNull();
    expect(decodeAction([])).toBeNull();
    expect(decodeAction('"str"')).toBeNull();
  });
  it('keeps a valid open_portal cat and drops an invalid one', () => {
    expect(decodeAction({ v: 1, a: 'open_portal', cat: 'skill' })).toEqual({ v: 1, a: 'open_portal', cat: 'skill' });
    expect(decodeAction({ v: 1, a: 'open_portal', cat: 'zzz' })).toEqual({ v: 1, a: 'open_portal' });
    expect(decodeAction({ v: 1, a: 'open_portal', cat: 5 })).toEqual({ v: 1, a: 'open_portal' });
  });
  it('nav without q defaults to empty query', () => {
    expect(decodeAction({ v: 1, a: 'nav', cat: 'kb', page: 0 })).toEqual({ v: 1, a: 'nav', cat: 'kb', page: 0, q: '' });
  });
});

describe('handleCardAction', () => {
  it('open_portal delivers a portal card to the operator and toasts by delivery route', async () => {
    const a = mk();
    const r = await handleCardAction(evt({ v: 1, a: 'open_portal' }), a.deps);
    expect(a.personalPortal).toHaveBeenCalledTimes(1);
    const [target, card] = a.personalPortal.mock.calls[0];
    expect(target).toEqual({ chatId: 'oc_1', openId: 'ou_1', chatType: 'group' });
    expect(json(card)).toContain('员工');
    expect(r.toast).toEqual({ type: 'success', content: '门户已发给你(仅你可见)' });

    const b = mk({ deliver: { personalPortal: async () => ({ via: 'p2p' }) } });
    const r2 = await handleCardAction(evt({ v: 1, a: 'open_portal' }), b.deps);
    expect(r2.toast).toEqual({ type: 'success', content: '已在私聊打开门户' });
  });

  it('open_portal with cat delivers a portal opened on that category', async () => {
    const es = [...many(3, { category: 'agent' }), ...many(3, { category: 'skill' })];
    const a = mk({}, es);
    await handleCardAction(evt({ v: 1, a: 'open_portal', cat: 'skill' }), a.deps);
    const card = a.personalPortal.mock.calls[0][1] as any;
    expect(card.header.subtitle.content.startsWith('Skill · ')).toBe(true);
    const b = mk({}, es);
    await handleCardAction(evt({ v: 1, a: 'open_portal' }), b.deps);
    expect((b.personalPortal.mock.calls[0][1] as any).header.subtitle.content.startsWith('数字员工 · ')).toBe(true);
  });

  it('nav returns a raw card for the requested category and page', async () => {
    const es = [...many(12, { category: 'agent' }), ...many(12, { category: 'kb', name: '知识库条目' })];
    const r = await handleCardAction(evt({ v: 1, a: 'nav', cat: 'kb', page: 1, q: '' }), mk({}, es).deps);
    expect(r.card?.type).toBe('raw');
    expect(json(r.card?.data)).toContain('知识库条目');
    expect(json(r.card?.data)).not.toContain('"员工');
  });

  it('nav past the last page returns the last page', async () => {
    const es = many(PAGE_SIZE + 2);
    const r = await handleCardAction(evt({ v: 1, a: 'nav', cat: 'agent', page: 99, q: '' }), mk({}, es).deps);
    expect(r.card?.type).toBe('raw');
    expect(json(r.card?.data)).toContain(es[es.length - 1].name);
    expect(json(r.card?.data)).not.toContain(es[0].name + '"');
  });

  it('search uses inputValue as query within the given category', async () => {
    const es = [e({ name: '独特甲' }), e({ name: '别的乙' }), e({ category: 'kb', name: '独特丙' })];
    const r = await handleCardAction(evt({ v: 1, a: 'search', cat: 'agent' }, { inputValue: '  独特  ' }), mk({}, es).deps);
    const s = json(r.card?.data);
    expect(s).toContain('独特甲');
    expect(s).not.toContain('别的乙');
    expect(s).not.toContain('独特丙');
    const input = find(r.card?.data, (o) => o.tag === 'input')[0];
    expect(input.default_value).toBe('独特');
  });

  it('caps a 2000-char query at 50 code points (search and nav)', async () => {
    const long = '字'.repeat(2000);
    const a = mk();
    const r = await handleCardAction(evt({ v: 1, a: 'search', cat: 'agent' }, { inputValue: long }), a.deps);
    expect(find(r.card?.data, (o) => o.tag === 'input')[0].default_value).toBe('字'.repeat(50));
    const r2 = await handleCardAction(evt({ v: 1, a: 'nav', cat: 'agent', page: 0, q: long }), a.deps);
    expect(find(r2.card?.data, (o) => o.tag === 'input')[0].default_value).toBe('字'.repeat(50));
  });

  it('passes banners through to the card', async () => {
    const banners = { brand: null, category: { agent: 'img_agent_key', skill: null, kb: null, service: null }, promoDefault: null, icons: { agent: null, skill: null, kb: null, service: null } };
    const r = await handleCardAction(evt({ v: 1, a: 'nav', cat: 'agent', page: 0, q: '' }), mk({ banners }).deps);
    expect(json(r.card?.data)).toContain('img_agent_key');
  });

  it('undecodable value returns 卡片已过期 warning toast', async () => {
    const r = await handleCardAction(evt('garbage'), mk().deps);
    expect(r.toast).toEqual({ type: 'warning', content: '卡片已过期,请重新打开门户' });
  });

  it('catalog unavailable returns 目录暂时读不到 error toast', async () => {
    const a = mk({ catalog: { get: async () => { throw new CatalogUnavailableError(); } } });
    for (const v of [{ v: 1, a: 'open_portal' }, { v: 1, a: 'nav', cat: 'agent', page: 0, q: '' }]) {
      const r = await handleCardAction(evt(v), a.deps);
      expect(r.toast).toEqual({ type: 'error', content: '目录暂时读不到,请稍后再试' });
    }
    expect(a.onError).not.toHaveBeenCalled();
  });

  it('delivery slower than 2000ms returns 门户发送失败 error toast and clears timers', async () => {
    vi.useFakeTimers();
    const a = mk({ deliver: { personalPortal: () => new Promise(() => {}) } });
    const p = handleCardAction(evt({ v: 1, a: 'open_portal' }), a.deps);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual({ toast: { type: 'error', content: '门户发送失败,请稍后再试' } });
    expect(a.onError).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fast delivery leaves no pending timer', async () => {
    vi.useFakeTimers();
    const a = mk();
    await handleCardAction(evt({ v: 1, a: 'open_portal' }), a.deps);
    expect(vi.getTimerCount()).toBe(0);
    expect(a.onError).not.toHaveBeenCalled();
  });

  it('delivery rejection returns the same error toast and calls onError', async () => {
    const boom = new Error('boom');
    const a = mk({ deliver: { personalPortal: async () => { throw boom; } } });
    const r = await handleCardAction(evt({ v: 1, a: 'open_portal' }), a.deps);
    expect(r.toast).toEqual({ type: 'error', content: '门户发送失败,请稍后再试' });
    expect(a.onError).toHaveBeenCalledWith(boom);
  });

  it('unexpected exception becomes an error toast and calls onError', async () => {
    const boom = new Error('kaboom');
    const a = mk({ catalog: { get: async () => { throw boom; } } });
    const r = await handleCardAction(evt({ v: 1, a: 'nav', cat: 'agent', page: 0, q: '' }), a.deps);
    expect(r.toast).toEqual({ type: 'error', content: '出了点问题,请稍后再试' });
    expect(a.onError).toHaveBeenCalledWith(boom);
  });

  it('works without onError (default no-op)', async () => {
    const a = mk({ onError: undefined, deliver: { personalPortal: async () => { throw new Error('x'); } } });
    const r = await handleCardAction(evt({ v: 1, a: 'open_portal' }), a.deps);
    expect(r.toast?.type).toBe('error');
  });
});
