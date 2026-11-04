import { describe, expect, it } from 'vitest';
import { buildPortalCard, filterEntries, PAGE_SIZE } from '../../src/cards/portal.js';
import { cardBytes, countElements, MAX_BYTES, MAX_ELEMENTS } from '../../src/cards/budget.js';
import { cardConfig } from '../../src/cards/theme.js';
import type { BannerKeys } from '../../src/cards/banners.js';
import type { CatalogEntry } from '../../src/catalog/types.js';

const dept = { name: '智能平台部', intro: '简介', routerLink: null as string | null };
let n = 0;
const e = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: `r${++n}`, category: 'agent', name: `员工${n}`, summary: '简介', detail: '详情',
  tags: ['t'], ownerOpenIds: [], link: 'https://example.com/x', order: n, hot: false, ...over,
});
const many = (k: number, over: Partial<CatalogEntry> = {}) => Array.from({ length: k }, () => e(over));
const json = (o: object) => JSON.stringify(o);
const view = (over = {}) => ({ category: 'agent' as const, page: 0, query: '', ...over });
const build = (es: CatalogEntry[], v = view(), b?: BannerKeys) => buildPortalCard(es, v, dept, b);

function find(node: unknown, pred: (o: any) => boolean, out: any[] = []): any[] {
  if (Array.isArray(node)) node.forEach((x) => find(x, pred, out));
  else if (node && typeof node === 'object') {
    if (pred(node)) out.push(node);
    Object.values(node).forEach((x) => find(x, pred, out));
  }
  return out;
}
const buttons = (c: object) => find(c, (o) => o.tag === 'button');
const btn = (c: object, label: string) => buttons(c).find((b) => b.text.content === label);

describe('buildPortalCard', () => {
  it('header and private subtitle', () => {
    const { card } = build(many(3)) as any;
    expect(card.schema).toBe('2.0');
    expect(card.header.title.content).toBe('智能平台部 · 门户');
    expect(card.header.subtitle.content).toBe('仅你可见 · 共 3 项');
  });

  it('current category button is primary_filled, others default', () => {
    const { card } = build(many(2), view({ category: 'kb' }));
    const tabs = ['数字员工', 'Skill', '知识库', '团队服务'].map((l) => btn(card, l));
    expect(tabs.map((t) => t.type)).toEqual(['default', 'default', 'primary_filled', 'default']);
    expect(tabs[0].behaviors[0].value).toEqual({ v: 1, a: 'nav', cat: 'agent', page: 0, q: '' });
  });

  it('paginates 8 per page', () => {
    expect(PAGE_SIZE).toBe(8);
    const es = many(10);
    const p0 = json(build(es).card);
    const p1 = json(build(es, view({ page: 1 })).card);
    expect(p0).toContain(`**${es[7].name}**`);
    expect(p0).not.toContain(`**${es[8].name}**`);
    expect(p1).toContain(`**${es[8].name}**`);
    expect(p1).not.toContain(`**${es[0].name}**`);
    expect(p0).toContain('第 1/2 页');
    expect(p1).toContain('第 2/2 页');
  });

  it('clamps an out-of-range page to the last page and returns the clamped view', () => {
    const r = build(many(10), view({ page: 9 }));
    expect(r.view.page).toBe(1);
    expect(json(r.card)).toContain('第 2/2 页');
    expect(build(many(10), view({ page: -3 })).view.page).toBe(0);
  });

  it('disables 上一页 on first page and 下一页 on last page', () => {
    const es = many(20, { name: 'x员工' });
    const first = build(es, view({ page: 0, query: 'x' })).card;
    expect(btn(first, '上一页').disabled).toBe(true);
    expect(btn(first, '下一页').disabled).toBeFalsy();
    expect(btn(first, '下一页').behaviors[0].value).toEqual({ v: 1, a: 'nav', cat: 'agent', page: 1, q: 'x' });
    const mid = build(es, view({ page: 1 })).card;
    expect(btn(mid, '上一页').disabled).toBeFalsy();
    expect(btn(mid, '上一页').behaviors[0].value.page).toBe(0);
    const last = build(es, view({ page: 2 })).card;
    expect(btn(last, '下一页').disabled).toBe(true);
    expect(btn(last, '上一页').disabled).toBeFalsy();
  });

  it('search matches name, summary or tag case-insensitively within the category', () => {
    const es = [
      e({ name: 'Alpha' }), e({ name: 'b', summary: 'has ALPHA inside' }), e({ name: 'c', tags: ['alPha'] }),
      e({ name: 'd' }), e({ name: 'Alpha skill', category: 'skill' }),
    ];
    expect(filterEntries(es, 'agent', 'alpha').map((x) => x.name)).toEqual(['Alpha', 'b', 'c']);
    expect(filterEntries(es, 'agent', '').length).toBe(4);
    expect(filterEntries(es, 'agent', '  ').length).toBe(4);
  });

  it('empty category shows 这个分类还没有登记条目', () => {
    const { card } = build([e({ category: 'skill' })]);
    expect(json(card)).toContain('这个分类还没有登记条目');
  });

  it('no match shows 没有找到和「x」相关的条目 (angle brackets neutralised)', () => {
    expect(json(build(many(2), view({ query: 'x' })).card)).toContain('没有找到和「x」相关的条目');
    const s = json(build(many(2), view({ query: '<at>' })).card);
    expect(s).toContain('没有找到和「＜at＞」相关的条目');
    expect(s).not.toContain('「<at>」');
  });

  it('zero results: pager reads 第 1/1 页 with both buttons disabled', () => {
    const { card, view: v } = build([], view({ page: 4 }));
    expect(v.page).toBe(0);
    expect(json(card)).toContain('第 1/1 页');
    expect(btn(card, '上一页').disabled).toBe(true);
    expect(btn(card, '下一页').disabled).toBe(true);
  });

  it('search input carries the current category in its callback value', () => {
    const { card } = build(many(2), view({ category: 'skill', query: 'abc' }));
    const input = find(card, (o) => o.tag === 'input')[0];
    expect(input.placeholder.content).toBe('搜索名称、简介或标签');
    expect(input.default_value).toBe('abc');
    expect(input.behaviors).toEqual([{ type: 'callback', value: { v: 1, a: 'search', cat: 'skill' } }]);
  });

  it('skill tab uses collapsible panels, others use tiles', () => {
    const sk = json(build([e({ category: 'skill' })], view({ category: 'skill' })).card);
    expect(sk).toContain('collapsible_panel');
    expect(json(build(many(1)).card)).not.toContain('collapsible_panel');
  });

  it('worst-case page stays within budget', () => {
    const worst = (category: any) =>
      many(8, { category, summary: '简'.repeat(200), detail: '详'.repeat(5000), tags: Array.from({ length: 10 }, (_, i) => `标签${i}`), ownerOpenIds: ['ou_x'] });
    for (const category of ['agent', 'skill', 'kb', 'service']) {
      const { card } = build(worst(category), view({ category: category as any, query: '简' }));
      expect(countElements(card)).toBeLessThanOrEqual(MAX_ELEMENTS);
      expect(cardBytes(card)).toBeLessThanOrEqual(MAX_BYTES);
    }
  });

  it('element_ids are unique and match the allowed pattern', () => {
    const { card } = build(many(10), view({ page: 1 }));
    const ids = find(card, (o) => 'element_id' in o).map((o) => o.element_id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z][A-Za-z0-9_]{0,19}$/);
  });

  it("renders the current category's banner first when set, and no img when null or omitted", () => {
    const b: BannerKeys = { brand: null, category: { agent: 'k_agent', skill: null, kb: null, service: null }, promoDefault: null };
    const withB = build(many(1), view(), b).card as any;
    expect(withB.body.elements[0].tag).toBe('img');
    expect(withB.body.elements[0].img_key).toBe('k_agent');
    expect(withB.body.elements[0].alt.content).toBe('数字员工');
    expect(find(build(many(1), view({ category: 'skill' }), b).card, (o) => o.tag === 'img')).toHaveLength(0);
    expect(find(build(many(1)).card, (o) => o.tag === 'img')).toHaveLength(0);
  });

  it('defines no unused colour tokens and references no undefined ones', () => {
    const { card } = build(many(3, { summary: '简介' }));
    const s = json(card);
    const defined = Object.keys((cardConfig() as any).style.color);
    for (const t of defined) expect(s).toContain(t);
    const used = new Set(s.match(/cus-[a-z-]+/g));
    for (const t of used) expect(defined).toContain(t);
  });
});
