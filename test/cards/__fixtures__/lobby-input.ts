import type { CatalogEntry } from '../../../src/catalog/types.js';

const me = 'ou_63152a4d56a2dac30a6d4a33008d35c8';
let n = 0;
const mk = (category: CatalogEntry['category'], name: string, o: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: `f${++n}`,
  category,
  name,
  summary: '自动汇总团队周报并发送给负责人,节省每周整理时间',
  detail: '每周五汇总团队周报',
  tags: ['效率', '周报', '协作'],
  ownerOpenIds: [],
  link: `https://example.com/${n}`,
  order: n,
  hot: false,
  ...o,
});

/** Fixed input shared by the Task 4 fixture generator and the regression test. */
export const FIXTURE_ENTRIES: CatalogEntry[] = [
  mk('agent', '周报助手', { hot: true, ownerOpenIds: [me] }),
  mk('agent', '代码评审员', { hot: true }),
  mk('agent', '会议纪要官'),
  mk('agent', '需求澄清师', { link: null }),
  mk('agent', '数据分析师'),
  mk('skill', 'PRD 写作'),
  mk('skill', 'SQL 生成', { link: null }),
  mk('kb', '研发规范库', { ownerOpenIds: [me] }),
  mk('service', '需求接入'),
];

export const FIXTURE_DEPT = {
  name: '智能平台部',
  intro: '让每个同事都找得到能帮上忙的数字员工',
  routerLink: null as string | null,
};
