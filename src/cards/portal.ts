import { CATEGORIES, CATEGORY_LABEL, type Category, type CatalogEntry } from '../catalog/types.js';
import { bannerImg, type BannerKeys } from './banners.js';
import { cardBytes, MAX_BYTES } from './budget.js';
import type { DeptInfo } from './lobby.js';
import { CATEGORY_TAG_COLOR, cardConfig, muted } from './theme.js';
import { entryTile, safe, skillPanel } from './tiles.js';

export const PAGE_SIZE = 8;

export interface PortalView {
  category: Category;
  page: number; // 从 0 开始
  query: string;
}

/** Skill 详情在整页超预算时逐档收缩。 */
const DETAIL_STEPS = [400, 200, 80, 0];

export function filterEntries(entries: CatalogEntry[], category: Category, query: string): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  return entries
    .filter((e) => e.category === category)
    .filter(
      (e) =>
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    );
}

function nav(cat: Category, page: number, q: string): object {
  return { type: 'callback', value: { v: 1, a: 'nav', cat, page, q } };
}

function tabs(view: PortalView): object {
  return {
    tag: 'column_set',
    flex_mode: 'none',
    horizontal_spacing: '0px',
    columns: CATEGORIES.map((c) => ({
      tag: 'column',
      width: 'weighted',
      weight: 1,
      elements: [
        {
          tag: 'button',
          element_id: `tab_${c}`,
          text: { tag: 'plain_text', content: CATEGORY_LABEL[c] },
          type: c === view.category ? 'primary_filled' : 'text',
          size: 'small',
          width: 'fill',
          behaviors: [nav(c, 0, '')],
        },
      ],
    })),
  };
}

function searchBox(view: PortalView): object {
  return {
    tag: 'input',
    element_id: 'search',
    name: 'q',
    width: 'fill',
    placeholder: { tag: 'plain_text', content: `在${CATEGORY_LABEL[view.category]}中搜索名称、简介或标签` },
    default_value: view.query,
    behaviors: [{ type: 'callback', value: { v: 1, a: 'search', cat: view.category } }],
  };
}

function emptyState(entriesInCategory: number): object {
  const text = entriesInCategory === 0 ? '这个分类还没有登记条目' : '没有找到相关内容,换个关键词试试';
  return { tag: 'markdown', content: muted(text) };
}

/** 仅 totalPages > 1 时调用。 */
function pager(view: PortalView, pages: number): object {
  const { category: cat, page, query: q } = view;
  const button = (id: string, label: string, target: number, disabled: boolean): object => ({
    tag: 'button',
    element_id: id,
    text: { tag: 'plain_text', content: label },
    type: 'text',
    size: 'small',
    width: 'fill',
    disabled,
    behaviors: [nav(cat, target, q)],
  });
  return {
    tag: 'column_set',
    flex_mode: 'none',
    horizontal_spacing: '8px',
    columns: [
      { tag: 'column', width: 'weighted', weight: 1, elements: [button('pg_prev', '上一页', page - 1, page <= 0)] },
      {
        tag: 'column',
        width: 'weighted',
        weight: 1,
        vertical_align: 'center',
        elements: [
          {
            tag: 'markdown',
            content: muted(`第 ${page + 1}/${pages} 页`),
            text_align: 'center',
          },
        ],
      },
      { tag: 'column', width: 'weighted', weight: 1, elements: [button('pg_next', '下一页', page + 1, page >= pages - 1)] },
    ],
  };
}

function render(
  view: PortalView,
  dept: DeptInfo,
  inCategory: number,
  matched: number,
  pageItems: CatalogEntry[],
  totalPages: number,
  banners: BannerKeys | undefined,
  detailMax: number,
): object {
  const label = CATEGORY_LABEL[view.category];
  const searching = view.query.trim() !== '';
  const banner = banners?.category[view.category] ?? null;
  const icon = banners?.icons?.[view.category] ?? null;
  const elements: object[] = [];
  // 分类矮条只在第 1 页且没有搜索词时显示
  if (banner && view.page === 0 && !searching) elements.push(bannerImg(banner, label));
  elements.push(tabs(view), searchBox(view));
  if (pageItems.length === 0) {
    elements.push(emptyState(inCategory));
  } else {
    elements.push({
      tag: 'column_set',
      flex_mode: 'none',
      columns: [
        {
          tag: 'column',
          width: 'weighted',
          weight: 1,
          vertical_spacing: '8px',
          elements: pageItems.map((e) => (e.category === 'skill' ? skillPanel(e, detailMax, icon) : entryTile(e, icon))),
        },
      ],
    });
  }
  if (totalPages > 1) elements.push(pager(view, totalPages));
  const subtitle = searching
    ? `${label} · 搜索“${view.query.trim()}” · ${matched} 项`
    : `${label} · ${inCategory} 项 · 你的专属门户`;
  return {
    schema: '2.0',
    config: cardConfig(),
    header: {
      title: { tag: 'plain_text', content: `${dept.name} · 门户` },
      subtitle: { tag: 'plain_text', content: subtitle },
      template: 'blue',
      icon: { tag: 'standard_icon', token: 'myai_colorful' },
      text_tag_list: [
        { tag: 'text_tag', text: { tag: 'plain_text', content: label }, color: CATEGORY_TAG_COLOR[view.category] },
      ],
    },
    body: { direction: 'vertical', padding: '12px 12px 20px 12px', vertical_spacing: '12px', elements },
  };
}

export function buildPortalCard(
  entries: CatalogEntry[],
  view: PortalView,
  dept: DeptInfo,
  banners?: BannerKeys,
): { card: object; view: PortalView } {
  const inCategory = entries.filter((e) => e.category === view.category).length;
  const matched = filterEntries(entries, view.category, view.query);
  const totalPages = Math.ceil(matched.length / PAGE_SIZE);
  const page = Math.min(Math.max(Math.trunc(view.page) || 0, 0), Math.max(totalPages - 1, 0));
  const clamped: PortalView = { category: view.category, page, query: view.query };
  const pageItems = matched.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  let card: object = {};
  for (const detailMax of DETAIL_STEPS) {
    card = render(clamped, dept, inCategory, matched.length, pageItems, totalPages, banners, detailMax);
    if (cardBytes(card) <= MAX_BYTES) break;
  }
  return { card, view: clamped };
}
