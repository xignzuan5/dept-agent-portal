import type { Category, CatalogEntry } from '../catalog/types.js';
import { CATEGORY_COLOR, categoryIcon, muted, shade } from './theme.js';

const SUMMARY_MAX = 60;
const TILE_TAGS_MAX = 2;
/** Skill 详情首档上限;整页超预算时由 portal 逐档收缩。 */
export const DETAIL_MAX = 400;
const DETAIL_SUFFIX = '…完整说明见文档';

export function truncate(s: string, max: number): string {
  const chars = [...s];
  return chars.length > max ? chars.slice(0, max).join('') + '…' : s;
}

/** 用户数据进 markdown 前把尖括号换成全角,避免误触发 <font>/<at> 等标签,同时保持可读。 */
export function safe(s: string): string {
  return s.replace(/</g, '＜').replace(/>/g, '＞');
}

function tagsMarkdown(tags: string[], cat: Category): string {
  return tags.map((t) => `<text_tag color='${CATEGORY_COLOR[cat]}'>${safe(t)}</text_tag>`).join(' ');
}

const inkBold = (s: string): string => `**<font color='cus-ink'>${safe(s)}</font>**`;

/**
 * Skill 详情:把「【标题】」转成独立一行的 **标题**,再按字数上限截断,
 * 超出以「…完整说明见文档」结尾。max=0 时返回空串。
 */
export function formatDetail(detail: string, max: number): string {
  if (max <= 0) return '';
  const text = detail
    .replace(/【([^】]*)】/g, '\n**$1**\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const chars = [...text];
  if (chars.length <= max) return text;
  let cut = chars.slice(0, max).join('');
  if ((cut.match(/\*\*/g) ?? []).length % 2 === 1) cut += '**'; // 截断处在加粗中间时补全
  return cut + DETAIL_SUFFIX;
}

const TILE_PADDING = '12px 12px 12px 12px';

/** 数字员工 / 知识库 / 团队服务磁贴:左图标,右名称 / 简介 / 标签。iconKey 缺失时退回 standard_icon。 */
export function entryTile(e: CatalogEntry, iconKey?: string | null): object {
  const right: object[] = [];
  const nameMd = inkBold(e.name);
  if (iconKey) {
    right.push({ tag: 'markdown', content: nameMd });
  } else {
    right.push({ tag: 'div', text: { tag: 'lark_md', content: nameMd }, icon: categoryIcon(e.category, null) });
  }
  if (e.summary) {
    right.push({ tag: 'markdown', content: muted(safe(truncate(e.summary, SUMMARY_MAX))), text_size: 'caption' });
  }
  const tags = e.tags.slice(0, TILE_TAGS_MAX);
  if (tags.length > 0) right.push({ tag: 'markdown', content: tagsMarkdown(tags, e.category) });
  if (!e.link) right.push({ tag: 'markdown', content: muted('链接未配置'), text_size: 'caption' });

  const columns: object[] = [];
  if (iconKey) {
    columns.push({
      tag: 'column',
      width: 'auto',
      vertical_align: 'top',
      elements: [
        {
          tag: 'img',
          img_key: iconKey,
          alt: { tag: 'plain_text', content: '' },
          scale_type: 'crop_center',
          size: 'small',
          corner_radius: '8px',
          transparent: true,
          preview: false,
        },
      ],
    });
  }
  columns.push({ tag: 'column', width: 'weighted', weight: 1, vertical_spacing: '2px', elements: right });
  const row = { tag: 'column_set', flex_mode: 'none', horizontal_spacing: '12px', columns };

  if (e.link) {
    return {
      tag: 'interactive_container',
      width: 'fill',
      background_style: shade(e.category, 50),
      has_border: true,
      border_color: shade(e.category, 100),
      corner_radius: '10px',
      padding: TILE_PADDING,
      behaviors: [{ type: 'open_url', default_url: e.link }],
      elements: [row],
    };
  }
  // 无链接:不可点,同样的浅底(column 不支持边框/圆角,只给底色)
  return {
    tag: 'column_set',
    flex_mode: 'none',
    columns: [
      {
        tag: 'column',
        width: 'weighted',
        weight: 1,
        background_style: shade(e.category, 50),
        padding: TILE_PADDING,
        elements: [row],
      },
    ],
  };
}

/** Skill:默认折叠的面板,展开依次是简介 / 查看文档 / 详情 / 标签。 */
export function skillPanel(e: CatalogEntry, detailMax: number = DETAIL_MAX, iconKey?: string | null): object {
  const elements: object[] = [];
  if (e.summary) {
    elements.push({ tag: 'markdown', content: muted(safe(truncate(e.summary, 200))), text_size: 'caption' });
  }
  if (e.link) {
    elements.push({
      tag: 'button',
      text: { tag: 'plain_text', content: '查看文档' },
      type: 'primary',
      size: 'small',
      behaviors: [{ type: 'open_url', default_url: e.link }],
    });
  }
  const detail = e.detail ? formatDetail(e.detail, detailMax) : '';
  if (detail) elements.push({ tag: 'markdown', content: safe(detail), text_size: 'body' });
  if (e.tags.length > 0) elements.push({ tag: 'markdown', content: tagsMarkdown(e.tags, 'skill') });

  const header: Record<string, unknown> = {
    title: { tag: 'markdown', content: `**${safe(e.name)}**` },
    background_color: shade('skill', 50),
  };
  if (iconKey) {
    header.icon = { tag: 'custom_icon', img_key: iconKey };
    header.icon_position = 'left';
  }
  return {
    tag: 'collapsible_panel',
    expanded: false,
    header,
    border: { color: shade('skill', 100), corner_radius: '10px' },
    vertical_spacing: '8px',
    padding: '8px 12px 12px 12px',
    elements,
  };
}
