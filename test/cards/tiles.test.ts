import { describe, expect, it } from 'vitest';
import { entryTile, skillPanel } from '../../src/cards/tiles.js';
import type { CatalogEntry } from '../../src/catalog/types.js';

const entry = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: 'r1',
  category: 'agent',
  name: '周报助手',
  summary: '自动汇总周报',
  detail: '每周五汇总',
  tags: ['效率'],
  ownerOpenIds: [],
  link: 'https://example.com/x',
  order: 1,
  hot: false,
  ...over,
});

const json = (o: object) => JSON.stringify(o);

describe('entryTile', () => {
  it('linked entry is a surface interactive_container opening its link', () => {
    const t = entryTile(entry()) as any;
    expect(t.tag).toBe('interactive_container');
    expect(t.background_style).toBe('blue-50');
    expect(t.has_border).toBe(true);
    expect(t.border_color).toBe('blue-100');
    expect(t.corner_radius).toBe('10px');
    expect(t.behaviors).toEqual([{ type: 'open_url', default_url: 'https://example.com/x' }]);
    expect(json(t)).toContain("**<font color='cus-ink'>周报助手</font>**");
    expect(json(t)).not.toContain('链接未配置');
    expect(json(t)).not.toContain('cus-primary-border');
  });

  it('with an icon key: auto-width icon column on the left, 2px-spaced text column on the right', () => {
    const t = entryTile(entry(), 'img_icon') as any;
    const row = t.elements[0];
    expect(row.horizontal_spacing).toBe('12px');
    expect(row.columns[0].width).toBe('auto');
    expect(row.columns[0].elements[0]).toMatchObject({ tag: 'img', img_key: 'img_icon', size: 'small', corner_radius: '8px' });
    expect(row.columns[1].vertical_spacing).toBe('2px');
  });

  it('without an icon key falls back to the standard_icon on the name', () => {
    const s = json(entryTile(entry()));
    expect(s).toContain('"tag":"standard_icon"');
    expect(s).not.toContain('"tag":"img"');
  });

  it('unlinked entry is not clickable, uses the same surface, and shows 链接未配置', () => {
    const t = entryTile(entry({ link: null })) as any;
    expect(t.tag).toBe('column_set');
    expect(t.columns[0].background_style).toBe('blue-50');
    expect(json(t)).not.toContain('open_url');
    expect(json(t)).toContain('链接未配置');
  });

  it('summary truncated to 60 chars with …', () => {
    const t = entryTile(entry({ summary: '字'.repeat(80) }));
    expect(json(t)).toContain('字'.repeat(60) + '…');
    expect(json(t)).not.toContain('字'.repeat(61));
    expect(json(entryTile(entry({ summary: '字'.repeat(60) })))).not.toContain('…');
  });

  it('tiles use the category -50 background, -100 border and category-coloured tags (agent, kb)', () => {
    const t = json(entryTile(entry({ tags: ['a1', 'b2', 'c3'] })));
    expect(t.match(/<text_tag/g)).toHaveLength(2);
    expect(t.match(/<text_tag color='blue'>/g)).toHaveLength(2);
    const kb = entryTile(entry({ category: 'kb', tags: ['k1'] })) as any;
    expect(kb).toMatchObject({ background_style: 'turquoise-50', border_color: 'turquoise-100' });
    expect(json(kb)).toContain("<text_tag color='turquoise'>k1</text_tag>");
    expect(t).not.toContain('c3');
  });

  it('never renders the owner person element', () => {
    const t = json(entryTile(entry({ ownerOpenIds: ['ou_a'] })));
    expect(t).not.toContain('"tag":"person"');
    expect(t).not.toContain('ou_a');
  });
});

describe('skillPanel', () => {
  const skill = (over: Partial<CatalogEntry> = {}) =>
    entry({ category: 'skill', name: '代码评审', summary: '帮你评审', detail: '详细说明正文', ...over });

  it('renders a collapsed panel: name-only title, surface header, line border', () => {
    const p = skillPanel(skill()) as any;
    expect(p.tag).toBe('collapsible_panel');
    expect(p.expanded).toBe(false);
    expect(p.header.title.content).toBe('**代码评审**');
    expect(p.header.background_color).toBe('violet-50');
    expect(p.border).toEqual({ color: 'violet-100', corner_radius: '10px' });
    expect(p.header.icon).toBeUndefined();
    expect(json(p.elements)).toContain('详细说明正文');
  });

  it('header icon is the custom_icon when a key is given', () => {
    const p = skillPanel(skill(), 400, 'img_skill') as any;
    expect(p.header.icon).toEqual({ tag: 'custom_icon', img_key: 'img_skill' });
  });

  it('expands in order: summary, 查看文档, detail, tags', () => {
    const p = skillPanel(skill({ tags: ['x1'] })) as any;
    expect(p.elements.map((x: any) => x.tag)).toEqual(['markdown', 'button', 'markdown', 'markdown']);
    expect(p.elements[0].content).toContain('帮你评审');
    expect(p.elements[1].type).toBe('primary');
    expect(p.elements[3].content).toContain("<text_tag color='violet'>x1</text_tag>");
  });

  it('skill detail converts 【标题】 to a bold line and caps at 400 chars ending with …完整说明见文档', () => {
    const p = json(skillPanel(skill({ detail: '【适用场景】评审代码【注意】先跑测试' })));
    expect(p).toContain('**适用场景**\\n评审代码');
    expect(p).toContain('**注意**\\n先跑测试');
    expect(p).not.toContain('【');
    const long = json(skillPanel(skill({ detail: '长'.repeat(500) })));
    expect(long).toContain('长'.repeat(400) + '…完整说明见文档');
    expect(long).not.toContain('长'.repeat(401));
    expect(json(skillPanel(skill({ detail: '长'.repeat(400) })))).not.toContain('完整说明见文档');
  });

  it('detailMax 0 drops the detail block', () => {
    expect(json(skillPanel(skill(), 0))).not.toContain('详细说明正文');
  });

  it('adds 查看文档 button only with a link, and never a person', () => {
    expect(json(skillPanel(skill()))).toContain('查看文档');
    expect(json(skillPanel(skill({ link: null })))).not.toContain('查看文档');
    expect(json(skillPanel(skill({ ownerOpenIds: ['ou_a'] })))).not.toContain('person');
  });

  it('shows all tags', () => {
    const p = skillPanel(skill({ tags: ['a1', 'b2', 'c3', 'd4'] }));
    expect(json(p).match(/<text_tag/g)).toHaveLength(4);
  });
});

describe('angle brackets in user text', () => {
  it('maps < and > to full-width instead of deleting', () => {
    const text = 'A -> B 与 List<string>';
    const want = 'A -＞ B 与 List＜string＞';
    const tile = json(entryTile(entry({ summary: text })));
    expect(tile).toContain(want);
    const panel = json(skillPanel(entry({ category: 'skill', summary: text, detail: text })));
    expect(panel).toContain(want);
    // the only raw '<' left are our own markup tags
    expect(tile.replace(/<\/?(font|text_tag)[^>]*>/g, '')).not.toMatch(/[<>]/);
    expect(panel.replace(/<\/?(font|text_tag)[^>]*>/g, '')).not.toMatch(/[<>]/);
  });
});
