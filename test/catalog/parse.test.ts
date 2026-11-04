import { describe, expect, it } from 'vitest';
import { parseRecords } from '../../src/catalog/parse.js';
import type { RawRecord } from '../../src/catalog/types.js';

const full = (over: Record<string, unknown> = {}): RawRecord => ({
  record_id: 'rec1',
  fields: {
    类型: '数字员工',
    名称: '周报助手',
    一句话简介: '自动汇总周报',
    详细说明: '每周五汇总团队周报\n并发送',
    标签: ['效率', '周报'],
    负责人: [{ id: 'ou_a', name: 'A' }, { id: 'ou_b' }],
    跳转链接: { link: 'https://example.com/x', text: '打开' },
    排序: 3,
    热门: true,
    上架: true,
    ...over,
  },
});

describe('parseRecords', () => {
  it('maps a full record', () => {
    const { entries, warnings } = parseRecords([full()]);
    expect(warnings).toEqual([]);
    expect(entries).toEqual([
      {
        id: 'rec1',
        category: 'agent',
        name: '周报助手',
        summary: '自动汇总周报',
        detail: '每周五汇总团队周报\n并发送',
        tags: ['效率', '周报'],
        ownerOpenIds: ['ou_a', 'ou_b'],
        link: 'https://example.com/x',
        order: 3,
        hot: true,
      },
    ]);
  });

  it('accepts text fields as plain string or rich-text segments', () => {
    const { entries } = parseRecords([
      full({ 名称: [{ type: 'text', text: '周报' }, { type: 'text', text: '助手' }] }),
    ]);
    expect(entries[0].name).toBe('周报助手');
  });

  it('skips unlisted, nameless and unknown-type records with a warning naming the record_id', () => {
    const bad: RawRecord[] = [
      { ...full({ 上架: false }), record_id: 'recUnlisted' },
      { ...full({ 名称: undefined }), record_id: 'recNameless' },
      { ...full({ 类型: '未知' }), record_id: 'recUnknown' },
    ];
    const { entries, warnings } = parseRecords(bad);
    expect(entries.length).toBe(0);
    expect(warnings.length).toBe(3);
    expect(warnings[0]).toContain('recUnlisted');
    expect(warnings[1]).toContain('recNameless');
    expect(warnings[2]).toContain('recUnknown');
  });

  it('nulls non-http links and warns', () => {
    const { entries, warnings } = parseRecords([
      full({ 跳转链接: { link: 'javascript:alert(1)', text: 'x' } }),
    ]);
    expect(entries[0].link).toBeNull();
    expect(warnings.some((w) => w.includes('rec1'))).toBe(true);
  });

  it('sorts by category order, then 排序, then 名称', () => {
    const mk = (id: string, 类型: string, 名称: string, 排序?: number): RawRecord => ({
      record_id: id,
      fields: { 类型, 名称, 上架: true, ...(排序 === undefined ? {} : { 排序 }) },
    });
    const { entries } = parseRecords([
      mk('s1', '团队服务', 'Z'),
      mk('a2', '数字员工', 'B', 2),
      mk('k1', '知识库', 'A'),
      mk('a1', '数字员工', 'Z', 1),
      mk('a3', '数字员工', 'A', 2),
      mk('sk', 'Skill', 'S'),
    ]);
    expect(entries.map((e) => e.id)).toEqual(['a1', 'a3', 'a2', 'sk', 'k1', 's1']);
  });
});
