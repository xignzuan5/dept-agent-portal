import { describe, expect, it } from 'vitest';
import { buildPortalCard, filterEntries, PAGE_SIZE } from '../../src/cards/portal.js';
import { buildLobbyCard } from '../../src/cards/lobby.js';
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
  it('header: category tag and p2p-style subtitle for browsing and searching', () => {
    const { card } = build(many(3)) as any;
    expect(card.schema).toBe('2.0');
    expect(card.header.title.content).toBe('智能平台部数字员工门户');
    expect(card.header.subtitle.content).toBe('数字员工 · 3 项 · 你的专属门户');
    expect(card.header.text_tag_list).toHaveLength(1);
    expect(card.header.text_tag_list[0]).toMatchObject({ text: { content: '数字员工' }, color: 'blue' });
    const sk = build([e({ category: 'skill' })], view({ category: 'skill' })).card as any;
    expect(sk.header.subtitle.content.startsWith('Skill · ')).toBe(true);
    expect(sk.header.text_tag_list[0].color).toBe('violet');
    const kb = build([e({ category: 'kb' })], view({ category: 'kb' })).card as any;
    expect(kb.header.text_tag_list[0].color).toBe('turquoise');
    expect((kb.header as any).template).toBe('turquoise');
    expect((build([e({ category: 'service' })], view({ category: 'service' })).card as any).header.template).toBe('orange');
    const q = build([e({ name: '报价员' }), e()], view({ query: '报价' })).card as any;
    expect(q.header.subtitle.content).toBe('数字员工 · 搜索“报价” · 1 项');
  });

  it('no portal card text contains 仅你可见', () => {
    const es = [...many(10), ...many(3, { category: 'skill' }), ...many(2, { category: 'kb' })];
    for (const category of ['agent', 'skill', 'kb', 'service'] as const) {
      expect(json(build(es, view({ category })).card)).not.toContain('仅你可见');
      expect(json(build(es, view({ category, query: 'x' })).card)).not.toContain('仅你可见');
    }
  });

  it('no card contains a person element (all four categories)', () => {
    const es = (['agent', 'skill', 'kb', 'service'] as const).flatMap((category) => many(3, { category, ownerOpenIds: ['ou_x'] }));
    for (const category of ['agent', 'skill', 'kb', 'service'] as const) {
      const s = json(build(es, view({ category })).card);
      expect(s).not.toContain('"tag":"person"');
      expect(s).not.toContain('ou_x');
    }
  });

  it('current tab is primary_filled and the other three are text', () => {
    const { card } = build(many(2), view({ category: 'kb' }));
    const tabs = ['数字员工', 'Skill', '知识库', '团队服务'].map((l) => btn(card, l));
    expect(tabs.map((t) => t.type)).toEqual(['text', 'text', 'primary_filled', 'text']);
    expect(find(card, (o) => o.tag === 'column_set' && o.columns.some((c: any) => c.elements[0]?.element_id === 'tab_agent'))[0].horizontal_spacing).toBe('0px');
    expect(tabs[0].behaviors[0].value).toEqual({ v: 1, a: 'nav', cat: 'agent', page: 0, q: '' });
  });

  it('paginates 8 per page', () => {
    expect(PAGE_SIZE).toBe(8);
    const es = many(10);
    const p0 = json(build(es).card);
    const p1 = json(build(es, view({ page: 1 })).card);
    expect(p0).toContain(`>${es[7].name}</font>`);
    expect(p0).not.toContain(`>${es[8].name}</font>`);
    expect(p1).toContain(`>${es[8].name}</font>`);
    expect(p1).not.toContain(`>${es[0].name}</font>`);
    expect(p0).toContain('第 1/2 页');
    expect(p1).toContain('第 2/2 页');
  });

  it('portal hides the pager when there is one page and shows it when there are 9 entries', () => {
    for (const k of [0, 1, 8]) {
      const c = build(many(k)).card;
      expect(btn(c, '上一页')).toBeUndefined();
      expect(btn(c, '下一页')).toBeUndefined();
      expect(json(c)).not.toContain('页</font>');
    }
    const c9 = build(many(9)).card;
    expect(btn(c9, '上一页')).toMatchObject({ type: 'text', disabled: true });
    expect(btn(c9, '下一页')).toMatchObject({ type: 'text' });
    expect(json(c9)).toContain("<font color='cus-muted'>第 1/2 页</font>");
  });

  it('entry tags render in the category colour', () => {
    const s = json(build(many(2, { tags: ['a1', 'b2'] })).card);
    expect(s).toContain("<text_tag color='blue'>a1</text_tag>");
    expect(s).not.toContain('neutral');
  });

  it('opens on a skill category with icon header and panels using the icon key', () => {
    const b: BannerKeys = { brand: null, category: { agent: null, skill: null, kb: null, service: null }, promoDefault: null, icons: { agent: 'ia', skill: 'is', kb: null, service: null } };
    const sk = json(build([e({ category: 'skill' })], view({ category: 'skill' }), b).card);
    expect(sk).toContain('"custom_icon","img_key":"is"');
    const ag = find(build(many(1), view(), b).card, (o) => o.tag === 'img');
    expect(ag.map((i) => i.img_key)).toEqual(['ia']);
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

  it('no match shows one muted line 没有找到相关内容,换个关键词试试', () => {
    const s = json(build(many(2), view({ query: 'x' })).card);
    expect(s).toContain("<font color='cus-muted'>没有找到相关内容,换个关键词试试</font>");
  });

  it('zero results: page is clamped to 0 and no pager is rendered', () => {
    const { card, view: v } = build([], view({ page: 4 }));
    expect(v.page).toBe(0);
    expect(btn(card, '上一页')).toBeUndefined();
  });

  it('search input carries the current category in its callback value', () => {
    const { card } = build(many(2), view({ category: 'skill', query: 'abc' }));
    const input = find(card, (o) => o.tag === 'input')[0];
    expect((card as any).body.elements).toContain(input);
    expect(input.placeholder.content).toBe('在Skill中搜索名称、简介或标签');
    expect(input.default_value).toBe('abc');
    expect(input.behaviors).toEqual([{ type: 'callback', value: { v: 1, a: 'search', cat: 'skill' } }]);
  });

  it('skill tab uses collapsible panels, others use tiles', () => {
    const sk = json(build([e({ category: 'skill' })], view({ category: 'skill' })).card);
    expect(sk).toContain('collapsible_panel');
    expect(json(build(many(1)).card)).not.toContain('collapsible_panel');
  });

  it('worst-case skill page (8 entries, 1500-char details) stays within 200 elements and 28KB', () => {
    const skills = many(8, { category: 'skill', summary: '简'.repeat(200), detail: '【段】' + '详'.repeat(1500), tags: Array.from({ length: 10 }, (_, i) => `标签${i}`), ownerOpenIds: ['ou_x'] });
    const b: BannerKeys = { brand: null, category: { agent: 'k', skill: 'k', kb: 'k', service: 'k' }, promoDefault: null, icons: { agent: 'i', skill: 'i', kb: 'i', service: 'i' } };
    const { card } = build(skills, view({ category: 'skill' }), b);
    expect(countElements(card)).toBeLessThanOrEqual(MAX_ELEMENTS);
    expect(cardBytes(card)).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('worst-case page of every category stays within budget', () => {
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

  const banners = (): BannerKeys => ({ brand: null, category: { agent: 'k_agent', skill: null, kb: null, service: null }, promoDefault: null, icons: { agent: null, skill: null, kb: null, service: null } });

  it("renders the current category's flush banner first when set, and no img when null or omitted", () => {
    const withB = build(many(1), view(), banners()).card as any;
    expect(withB.body.elements[0].tag).toBe('img');
    expect(withB.body.elements[0].img_key).toBe('k_agent');
    expect(withB.body.elements[0].alt.content).toBe('数字员工');
    expect(withB.body.elements[0].margin).toBe('-12px -12px 0px -12px');
    expect(find(build(many(1), view({ category: 'skill' }), banners()).card, (o) => o.tag === 'img')).toHaveLength(0);
    expect(find(build(many(1)).card, (o) => o.tag === 'img')).toHaveLength(0);
  });

  it('portal hides the category banner when searching or past page 1', () => {
    const imgs = (v: object, es = many(12)) => find(build(es, view(v), banners()).card, (o) => o.tag === 'img').length;
    expect(imgs({})).toBe(1);
    expect(imgs({ page: 1 })).toBe(0);
    expect(imgs({ query: 'e' })).toBe(0);
    expect(imgs({ query: '  ' })).toBe(1);
  });

  it('references only defined colour tokens and never the removed border token', () => {
    const s = json(build(many(3, { summary: '简介' }), view(), banners()).card);
    const defined = Object.keys((cardConfig() as any).style.color);
    expect(defined).not.toContain('cus-primary-border');
    expect(s).not.toContain('cus-primary-border');
    for (const t of new Set(s.match(/cus-[a-z-]+/g))) expect(defined).toContain(t);
  });
});

describe('colour token coverage', () => {
  it('every token defined in cardConfig is used by some card across the lobby and four portal categories', () => {
    const b: BannerKeys = { brand: 'b', category: { agent: 'k', skill: 'k', kb: 'k', service: 'k' }, promoDefault: 'p', icons: { agent: 'i', skill: 'i', kb: 'i', service: 'i' } };
    const es = (['agent', 'skill', 'kb', 'service'] as const).flatMap((category) => many(3, { category, hot: true }));
    const cards: object[] = [
      buildLobbyCard(es, dept, { banners: b, promos: [{ id: 'p', title: 't', subtitle: 's', link: null, imgKey: null, start: null, end: null, order: 1 }], now: 1 }),
      ...(['agent', 'skill', 'kb', 'service'] as const).map((category) => build(es, view({ category }), b).card),
    ];
    const used = new Set(cards.flatMap((c: any) => json({ header: c.header, body: c.body }).match(/cus-[a-z-]+/g) ?? []));
    for (const t of Object.keys((cardConfig() as any).style.color)) expect(used).toContain(t);
  });
});
