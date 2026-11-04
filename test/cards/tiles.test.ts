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
  it('linked entry is an interactive_container opening its link', () => {
    const t = entryTile(entry()) as any;
    expect(t.tag).toBe('interactive_container');
    expect(t.has_border).toBe(true);
    expect(t.corner_radius).toBe('8px');
    expect(t.behaviors).toEqual([{ type: 'open_url', default_url: 'https://example.com/x' }]);
    expect(json(t)).toContain('**周报助手**');
    expect(json(t)).not.toContain('链接未配置');
  });

  it('unlinked entry is not clickable and shows 链接未配置', () => {
    const t = entryTile(entry({ link: null })) as any;
    expect(t.tag).toBe('column_set');
    expect(json(t)).not.toContain('open_url');
    expect(json(t)).toContain('链接未配置');
  });

  it('summary truncated to 60 chars with …', () => {
    const t = entryTile(entry({ summary: '字'.repeat(80) }));
    expect(json(t)).toContain('字'.repeat(60) + '…');
    expect(json(t)).not.toContain('字'.repeat(61));
    expect(json(entryTile(entry({ summary: '字'.repeat(60) })))).not.toContain('…');
  });

  it('at most 3 tags shown', () => {
    const t = entryTile(entry({ tags: ['a1', 'b2', 'c3', 'd4', 'e5'] }));
    expect(json(t).match(/<text_tag/g)).toHaveLength(3);
    expect(json(t)).not.toContain('d4');
  });

  it('shows the first owner as a person element', () => {
    const t = json(entryTile(entry({ ownerOpenIds: ['ou_a', 'ou_b'] })));
    expect(t).toContain('"tag":"person"');
    expect(t).toContain('ou_a');
    expect(t).not.toContain('ou_b');
  });
});

describe('skillPanel', () => {
  const skill = (over: Partial<CatalogEntry> = {}) =>
    entry({ category: 'skill', name: '代码评审', summary: '帮你评审', detail: '详细说明正文', ...over });

  it('skill renders as collapsed collapsible_panel containing the detail', () => {
    const p = skillPanel(skill()) as any;
    expect(p.tag).toBe('collapsible_panel');
    expect(p.expanded).toBe(false);
    expect(p.header.title.content).toBe('**代码评审** · 帮你评审');
    expect(json(p.elements)).toContain('详细说明正文');
  });

  it('detail truncated to 1500 chars', () => {
    const p = skillPanel(skill({ detail: '长'.repeat(1600) }));
    expect(json(p)).toContain('长'.repeat(1500) + '…');
    expect(json(p)).not.toContain('长'.repeat(1501));
  });

  it('adds 查看文档 button only with a link', () => {
    expect(json(skillPanel(skill()))).toContain('查看文档');
    expect(json(skillPanel(skill({ link: null })))).not.toContain('查看文档');
  });

  it('shows all tags', () => {
    const p = skillPanel(skill({ tags: ['a1', 'b2', 'c3', 'd4'] }));
    expect(json(p).match(/<text_tag/g)).toHaveLength(4);
  });
});
