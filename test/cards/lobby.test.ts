import { describe, expect, it } from 'vitest';
import { buildLobbyCard } from '../../src/cards/lobby.js';
import type { BannerKeys, Promo } from '../../src/cards/banners.js';
import { cardBytes, countElements, MAX_BYTES, MAX_ELEMENTS } from '../../src/cards/budget.js';
import type { CatalogEntry } from '../../src/catalog/types.js';

const dept = { name: '智能平台部', intro: '找到能帮上忙的数字员工', routerLink: null as string | null };

let n = 0;
const e = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: `r${++n}`,
  category: 'agent',
  name: `员工${n}`,
  summary: '简介',
  detail: '详情',
  tags: ['t'],
  ownerOpenIds: [],
  link: 'https://example.com/x',
  order: n,
  hot: false,
  ...over,
});

const json = (o: object) => JSON.stringify(o);

function find(node: unknown, pred: (o: any) => boolean, out: any[] = []): any[] {
  if (Array.isArray(node)) node.forEach((x) => find(x, pred, out));
  else if (node && typeof node === 'object') {
    if (pred(node)) out.push(node);
    Object.values(node).forEach((x) => find(x, pred, out));
  }
  return out;
}

describe('buildLobbyCard', () => {
  it('schema 2.0 with title, subtitle and no count tag', () => {
    const c = buildLobbyCard([e(), e(), e({ category: 'skill' })], dept) as any;
    expect(c.schema).toBe('2.0');
    expect(c.header.title.content).toBe('智能平台部数字员工门户');
    expect(c.header.subtitle.content).toBe(dept.intro);
    expect(c.header.template).toBe('blue');
    expect(c.header.text_tag_list).toBeUndefined();
  });

  it('lobby has four category entries calling open_portal with agent, skill, kb, service in order', () => {
    const c = buildLobbyCard([e(), e(), e({ category: 'skill' }), e({ category: 'kb' })], dept) as any;
    const cells = find(c.body, (o) => o.tag === 'interactive_container' && o.behaviors?.[0]?.value?.a === 'open_portal');
    expect(cells.map((x) => x.behaviors[0].value)).toEqual(
      ['agent', 'skill', 'kb', 'service'].map((cat) => ({ v: 1, a: 'open_portal', cat })),
    );
    expect(cells.map((x) => x.behaviors[0].type)).toEqual(['callback', 'callback', 'callback', 'callback']);
    const grid = c.body.elements.filter((x: any) => x.tag === 'column_set').slice(0, 2);
    expect(grid.map((g: any) => g.columns.length)).toEqual([2, 2]);
    expect(cells[0]).toMatchObject({ background_style: 'cus-surface', has_border: true, border_color: 'cus-line', corner_radius: '10px' });
    const txt = cells.map((x) => JSON.stringify(x.elements));
    expect(txt[0]).toContain('数字员工');
    expect(txt[0]).toContain("<font color='cus-muted'>2</font>");
    expect(txt[1]).toContain("<font color='cus-muted'>1</font>");
    expect(txt[3]).toContain("<font color='cus-muted'>0</font>");
    expect(txt.map((t) => ['帮你干活的 AI 同事', '即装即用的销售技能', '产品、报价与案例', '审批与售前支持'].some((w) => t.includes(w)))).toEqual([true, true, true, true]);
  });

  it('entry cells use the category icon img_key as custom_icon, else standard_icon', () => {
    const icons = { agent: 'ia', skill: null, kb: 'ik', service: null };
    const bn: BannerKeys = { brand: null, category: { agent: null, skill: null, kb: null, service: null }, promoDefault: null, icons };
    const cells = find(buildLobbyCard([e()], dept, { banners: bn }), (o) => o.tag === 'interactive_container' && o.behaviors?.[0]?.value?.cat);
    const img = (x: any) => find(x, (o) => o.tag === 'img')[0];
    expect(img(cells[0])).toMatchObject({ img_key: 'ia', size: '28px 28px', transparent: true, scale_type: 'crop_center', corner_radius: '6px' });
    const row = cells[0].elements[0];
    expect(row).toMatchObject({ tag: 'column_set', flex_mode: 'none', horizontal_spacing: '8px' });
    expect(row.columns[0].width).toBe('auto');
    expect(row.columns[1]).toMatchObject({ width: 'weighted', vertical_align: 'center' });
    expect(JSON.stringify(row.columns[1])).toContain('数字员工');
    expect(JSON.stringify(row)).not.toContain('帮你干活');
    expect(cells[0].elements[1]).toMatchObject({ tag: 'markdown', text_size: 'caption' });
    expect(cells[0].elements[1].content).toContain('帮你干活');
    expect(find(cells[1], (o) => o.tag === 'img')).toHaveLength(0);
    expect(find(cells[1], (o) => o.tag === 'standard_icon')).toHaveLength(1);
    expect(img(cells[2]).img_key).toBe('ik');
  });

  it('shows up to 4 hot agents and backfills by order', () => {
    const agents = [
      e({ name: 'A5', order: 5, hot: true }),
      e({ name: 'A1', order: 1 }),
      e({ name: 'A2', order: 2 }),
      e({ name: 'A3', order: 3, hot: true }),
      e({ name: 'A4', order: 4 }),
    ];
    const s = json(buildLobbyCard(agents, dept));
    for (const name of ['A5', 'A3', 'A1', 'A2']) expect(s).toContain(`>${name}</font>`);
    expect(s).not.toContain('>A4</font>');
    const many = Array.from({ length: 6 }, (_, i) => e({ name: `H${i}`, order: i, hot: true }));
    const s2 = json(buildLobbyCard(many, dept));
    expect(s2).toContain('>H3</font>');
    expect(s2).not.toContain('>H4</font>');
  });

  it('hot section title uses the title size and a text button 「全部 N 个 →」 opening the agent category', () => {
    const c = buildLobbyCard([e({ hot: true }), e(), e({ category: 'skill' })], dept);
    const title = find(c, (o) => o.tag === 'markdown' && o.content === '**热门数字员工**')[0];
    expect(title.text_size).toBe('title');
    const all = find(c, (o) => o.tag === 'button' && o.text.content === '全部 2 个 →')[0];
    expect(all).toMatchObject({ type: 'text', size: 'small' });
    expect(all.behaviors).toEqual([{ type: 'callback', value: { v: 1, a: 'open_portal', cat: 'agent' } }]);
  });

  it('has the open_portal main button (no cat), large and filled', () => {
    const c = buildLobbyCard([e()], dept);
    const b = find(c, (o) => o.tag === 'button' && o.text.content === '打开门户')[0];
    expect(b).toMatchObject({ type: 'primary_filled', width: 'fill', size: 'large' });
    expect(b.behaviors).toEqual([{ type: 'callback', value: { v: 1, a: 'open_portal' } }]);
  });

  it('router button only when routerLink set', () => {
    expect(json(buildLobbyCard([e()], dept))).not.toContain('问路由助手');
    const s = json(buildLobbyCard([e()], { ...dept, routerLink: 'https://example.com/router' }));
    expect(s).toContain('问路由助手');
    expect(s).toContain('"default_url":"https://example.com/router"');
  });

  it('empty catalog renders zero counts and no hot section', () => {
    const c = buildLobbyCard([], dept) as any;
    expect(json(c)).toContain("<font color='cus-muted'>0</font>");
    expect(json(c)).not.toContain('热门数字员工');
    expect(json(c)).toContain('打开门户');
  });

  it('no card contains a person element', () => {
    const withOwner = [e({ hot: true, ownerOpenIds: ['ou_x'] }), e({ category: 'skill', ownerOpenIds: ['ou_x'] })];
    expect(json(buildLobbyCard(withOwner, dept))).not.toContain('"tag":"person"');
  });

  it('lobby stays within MAX_ELEMENTS and MAX_BYTES', () => {
    const many = Array.from({ length: 60 }, (_, i) => e({ name: `员工${i}`, summary: '字'.repeat(100), hot: i < 10 }));
    const c = buildLobbyCard(many, { ...dept, routerLink: 'https://example.com/r' });
    expect(countElements(c)).toBeLessThanOrEqual(MAX_ELEMENTS);
    expect(cardBytes(c)).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('references only defined colour tokens and text sizes, and never the removed border token', () => {
    const c = buildLobbyCard([e({ hot: true }), e({ link: null, hot: true })], dept) as any;
    const defined = Object.keys(c.config.style.color);
    expect(defined).not.toContain('cus-primary-border');
    const body = JSON.stringify({ header: c.header, body: c.body });
    for (const u of new Set(body.match(/cus-[a-z-]+/g) ?? [])) expect(defined).toContain(u);
    expect(body).not.toContain('cus-primary-border');
    for (const t of body.match(/"text_size":"([a-z-]+)"/g) ?? []) {
      const name = t.split('"')[3];
      expect(['caption', 'body', 'title']).toContain(name);
      expect(Object.keys(c.config.style.text_size)).toContain(name);
    }
  });
});

describe('buildLobbyCard banners and promo', () => {
  const banners: BannerKeys = {
    brand: 'img_brand',
    category: { agent: null, skill: null, kb: null, service: null },
    promoDefault: 'img_promo_default',
    icons: { agent: null, skill: null, kb: null, service: null },
  };
  const mkPromo = (over: Partial<Promo> = {}): Promo => ({
    id: 'p1', title: '促销一', subtitle: '说明一', link: 'https://example.com/1', imgKey: null,
    start: null, end: null, order: 1, ...over,
  });
  const fixed = [e({ hot: true }), e({ category: 'skill' })];
  const entries = () => fixed;

  it('lobby hero image is flush with the header (margin top -12px) and header has no count tag', () => {
    const c = buildLobbyCard(entries(), dept, { banners }) as any;
    const first = c.body.elements[0];
    expect(first.tag).toBe('img');
    expect(first.img_key).toBe('img_brand');
    expect(first.margin).toBe('-12px -12px 0px -12px');
    expect(c.header.text_tag_list).toBeUndefined();
  });

  it('no img when banners omitted, and promos ignore missing banners', () => {
    expect(json(buildLobbyCard(entries(), dept))).not.toContain('"tag":"img"');
    expect(json(buildLobbyCard(entries(), dept, {}))).toBe(json(buildLobbyCard(entries(), dept)));
  });

  it('places the promo strip last, after the hot section', () => {
    const c = buildLobbyCard(entries(), dept, { banners, promos: [mkPromo()], now: 1 }) as any;
    const els = c.body.elements;
    expect(els[0].tag).toBe('img');
    const last = els[els.length - 1];
    expect(last.tag).toBe('interactive_container');
    expect(last.background_style).toBe('cus-accent-bg');
    expect(last.behaviors[0].type).toBe('open_url');
    expect(JSON.stringify(last)).toContain('img_promo_default');
    expect(els.indexOf(last)).toBeGreaterThan(els.findIndex((x: any) => JSON.stringify(x).includes('热门数字员工')));
  });

  it('shows only the first active promo', () => {
    const s = json(
      buildLobbyCard(entries(), dept, {
        banners,
        promos: [mkPromo({ id: 'b', title: '第二个', order: 2 }), mkPromo({ id: 'a', title: '第一个', order: 1 })],
        now: 1,
      }),
    );
    expect(s).toContain('第一个');
    expect(s).not.toContain('第二个');
  });

  it('expired promo is not shown', () => {
    const s = json(buildLobbyCard(entries(), dept, { banners, promos: [mkPromo({ end: 5 })], now: 5 }));
    expect(s).not.toContain('促销一');
    expect(s).not.toContain('https://example.com/1');
  });

  it('lobby with banner and promo stays within MAX_ELEMENTS and MAX_BYTES', () => {
    const many = Array.from({ length: 12 }, () => e({ hot: true }));
    const c = buildLobbyCard(many, { ...dept, routerLink: 'https://example.com/r' }, { banners, promos: [mkPromo()], now: 1 });
    expect(countElements(c)).toBeLessThanOrEqual(MAX_ELEMENTS);
    expect(cardBytes(c)).toBeLessThanOrEqual(MAX_BYTES);
  });

  const usedColors = (c: any) => new Set(JSON.stringify({ h: c.header, b: c.body }).match(/cus-[a-z-]+/g) ?? []);
  const checkTokens = (c: any, bothWays: boolean) => {
    const defined = Object.keys(c.config.style.color);
    const used = usedColors(c);
    for (const u of used) expect(defined).toContain(u);
    if (bothWays) for (const d of defined) expect(used.has(d)).toBe(true);
    for (const t of JSON.stringify(c.body).match(/"text_size":"([a-z-]+)"/g) ?? []) {
      expect(Object.keys(c.config.style.text_size)).toContain(t.split('"')[3]);
    }
  };

  it('tokens are consistent with banners and a linked promo', () => {
    const c = buildLobbyCard(entries(), dept, { banners, promos: [mkPromo()], now: 1 }) as any;
    expect(JSON.stringify(c.body)).toContain('"tag":"img"');
    checkTokens(c, false);
  });

  it('referenced tokens are defined with banners and an unlinked promo', () => {
    const c = buildLobbyCard(entries(), dept, { banners, promos: [mkPromo({ link: null })], now: 1 }) as any;
    expect(JSON.stringify(c.body)).toContain('img_promo_default');
    checkTokens(c, false);
  });

  it('stress: long promo text and heavy hot agents stay within budget', () => {
    const heavy = Array.from({ length: 4 }, (_, i) =>
      e({ hot: true, summary: '长'.repeat(200), tags: Array.from({ length: 10 }, (_, k) => `标签${i}-${k}`) }),
    );
    const c = buildLobbyCard(heavy, { ...dept, routerLink: 'https://example.com/r' }, {
      banners,
      promos: [mkPromo({ title: '题'.repeat(200), subtitle: '述'.repeat(500) })],
      now: 1,
    });
    expect(json(c)).toContain('题'.repeat(200));
    expect(countElements(c)).toBeLessThanOrEqual(MAX_ELEMENTS);
    expect(cardBytes(c)).toBeLessThanOrEqual(MAX_BYTES);
  });
});
