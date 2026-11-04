import { describe, expect, it } from 'vitest';
import { buildLobbyCard } from '../../src/cards/lobby.js';
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

describe('buildLobbyCard', () => {
  it('schema 2.0 with title and counts tag', () => {
    const c = buildLobbyCard(
      [e(), e(), e({ category: 'skill' })],
      dept,
    ) as any;
    expect(c.schema).toBe('2.0');
    expect(c.header.title.content).toBe('智能平台部数字员工门户');
    expect(c.header.subtitle.content).toBe(dept.intro);
    expect(c.header.template).toBe('blue');
    expect(c.header.text_tag_list[0].text.content).toBe('2 个数字员工 · 1 个 Skill');
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
    for (const name of ['A5', 'A3', 'A1', 'A2']) expect(s).toContain(`**${name}**`);
    expect(s).not.toContain('**A4**');
    const many = Array.from({ length: 6 }, (_, i) => e({ name: `H${i}`, order: i, hot: true }));
    const s2 = json(buildLobbyCard(many, dept));
    expect(s2).toContain('**H3**');
    expect(s2).not.toContain('**H4**');
  });

  it('has open_portal callback button', () => {
    const s = json(buildLobbyCard([e()], dept));
    expect(s).toContain('"value":{"v":1,"a":"open_portal"}');
    expect(s).toContain('打开门户');
    expect(s).toContain('primary_filled');
  });

  it('router button only when routerLink set', () => {
    expect(json(buildLobbyCard([e()], dept))).not.toContain('问路由助手');
    const s = json(buildLobbyCard([e()], { ...dept, routerLink: 'https://example.com/router' }));
    expect(s).toContain('问路由助手');
    expect(s).toContain('"default_url":"https://example.com/router"');
  });

  it('empty catalog renders zero counts and no hot section', () => {
    const c = buildLobbyCard([], dept) as any;
    expect(c.header.text_tag_list[0].text.content).toBe('0 个数字员工 · 0 个 Skill');
    expect(json(c)).not.toContain('热门数字员工');
    expect(json(c)).toContain('打开门户');
  });

  it('lobby stays within MAX_ELEMENTS and MAX_BYTES', () => {
    const many = Array.from({ length: 60 }, (_, i) => e({ name: `员工${i}`, summary: '字'.repeat(100), hot: i < 10 }));
    const c = buildLobbyCard(many, { ...dept, routerLink: 'https://example.com/r' });
    expect(countElements(c)).toBeLessThanOrEqual(MAX_ELEMENTS);
    expect(cardBytes(c)).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('references cus-primary and only defines-used cus-* tokens', () => {
    const c = buildLobbyCard([e({ hot: true, ownerOpenIds: [] }), e({ link: null, hot: true })], dept) as any;
    const defined = Object.keys(c.config.style.color);
    const body = JSON.stringify({ header: c.header, body: c.body });
    const used = new Set(body.match(/cus-[a-z-]+/g) ?? []);
    expect(used.has('cus-primary')).toBe(true);
    for (const u of used) expect(defined).toContain(u);
    for (const d of defined) expect(used.has(d)).toBe(true);
    for (const t of body.match(/"text_size":"([a-z-]+)"/g) ?? []) {
      const name = t.split('"')[3];
      expect(['caption', 'body']).toContain(name);
      expect(Object.keys(c.config.style.text_size)).toContain(name);
    }
  });
});
