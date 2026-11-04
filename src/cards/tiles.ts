import type { CatalogEntry } from '../catalog/types.js';
import { CATEGORY_ICON } from './theme.js';

const SUMMARY_MAX = 60;
const DETAIL_MAX = 1500;
const TILE_TAGS_MAX = 3;

export function truncate(s: string, max: number): string {
  const chars = [...s];
  return chars.length > max ? chars.slice(0, max).join('') + '…' : s;
}

/** 用户数据进 markdown 前把尖括号换成全角,避免误触发 <font>/<at> 等标签,同时保持可读。 */
function safe(s: string): string {
  return s.replace(/</g, '＜').replace(/>/g, '＞');
}

function tagsMarkdown(tags: string[]): string {
  return tags.map((t) => `<text_tag color='blue'>${safe(t)}</text_tag>`).join(' ');
}

function ownerPerson(openId: string): object {
  return { tag: 'person', user_id: openId, size: 'small', show_name: true, show_avatar: true };
}

/** 磁贴正文:图标+加粗名称 / 灰色简介 / 标签与负责人一行。 */
function tileBody(e: CatalogEntry, tagLimit: number): object[] {
  const body: object[] = [
    {
      tag: 'div',
      text: { tag: 'lark_md', content: `**${safe(e.name)}**` },
      icon: { tag: 'standard_icon', token: CATEGORY_ICON[e.category] },
    },
  ];
  if (e.summary) {
    body.push({
      tag: 'markdown',
      content: `<font color='cus-muted'>${safe(truncate(e.summary, SUMMARY_MAX))}</font>`,
      text_size: 'caption',
    });
  }
  const tags = e.tags.slice(0, tagLimit);
  const owner = e.ownerOpenIds[0];
  if (tags.length > 0 || owner) {
    const columns: object[] = [];
    if (tags.length > 0) {
      columns.push({
        tag: 'column',
        width: 'weighted',
        weight: 1,
        vertical_align: 'center',
        elements: [{ tag: 'markdown', content: tagsMarkdown(tags) }],
      });
    }
    if (owner) {
      columns.push({
        tag: 'column',
        width: 'auto',
        vertical_align: 'center',
        elements: [ownerPerson(owner)],
      });
    }
    body.push({
      tag: 'column_set',
      flex_mode: 'none',
      horizontal_spacing: '8px',
      columns,
    });
  }
  return body;
}

/** 数字员工 / 知识库 / 团队服务磁贴。 */
export function entryTile(e: CatalogEntry): object {
  const body = tileBody(e, TILE_TAGS_MAX);
  if (e.link) {
    return {
      tag: 'interactive_container',
      width: 'fill',
      has_border: true,
      border_color: 'cus-primary-border',
      corner_radius: '8px',
      padding: '12px 12px 12px 12px',
      vertical_spacing: '4px',
      behaviors: [{ type: 'open_url', default_url: e.link }],
      elements: body,
    };
  }
  body.push({
    tag: 'markdown',
    content: "<font color='cus-muted'>链接未配置</font>",
    text_size: 'caption',
  });
  return {
    tag: 'column_set',
    flex_mode: 'none',
    columns: [
      {
        tag: 'column',
        width: 'weighted',
        weight: 1,
        background_style: 'grey-50',
        padding: '12px 12px 12px 12px',
        vertical_spacing: '4px',
        elements: body,
      },
    ],
  };
}

/** Skill:默认折叠的面板,展开看详细说明。 */
export function skillPanel(e: CatalogEntry): object {
  const elements: object[] = [];
  if (e.detail) {
    elements.push({ tag: 'markdown', content: safe(truncate(e.detail, DETAIL_MAX)), text_size: 'body' });
  }
  const owner = e.ownerOpenIds[0];
  if (e.tags.length > 0 || owner) {
    const columns: object[] = [];
    if (e.tags.length > 0) {
      columns.push({
        tag: 'column',
        width: 'weighted',
        weight: 1,
        vertical_align: 'center',
        elements: [{ tag: 'markdown', content: tagsMarkdown(e.tags) }],
      });
    }
    if (owner) {
      columns.push({ tag: 'column', width: 'auto', vertical_align: 'center', elements: [ownerPerson(owner)] });
    }
    elements.push({ tag: 'column_set', flex_mode: 'none', horizontal_spacing: '8px', columns });
  }
  if (e.link) {
    elements.push({
      tag: 'button',
      text: { tag: 'plain_text', content: '查看文档' },
      type: 'default',
      size: 'small',
      behaviors: [{ type: 'open_url', default_url: e.link }],
    });
  }
  return {
    tag: 'collapsible_panel',
    expanded: false,
    header: {
      title: { tag: 'markdown', content: `**${safe(e.name)}** · ${safe(e.summary)}` },
      icon: { tag: 'standard_icon', token: CATEGORY_ICON.skill },
      icon_position: 'left',
    },
    border: { color: 'cus-primary-border', corner_radius: '8px' },
    vertical_spacing: '8px',
    padding: '4px 12px 12px 12px',
    elements,
  };
}
