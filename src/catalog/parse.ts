import { CATEGORIES, CATEGORY_LABEL } from './types.js';
import type { CatalogEntry, Category, RawRecord } from './types.js';

const DEFAULT_ORDER = 9999;
const BOT_APPLINK_PREFIX = 'https://applink.feishu.cn/client/bot/open?appId=';

const CATEGORY_BY_LABEL = new Map<string, Category>(
  CATEGORIES.map((c) => [CATEGORY_LABEL[c], c]),
);

/** Text field: plain string or an array of `{text}` segments. */
function readText(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) {
    return v
      .map((s) => (s && typeof (s as { text?: unknown }).text === 'string' ? (s as { text: string }).text : ''))
      .join('')
      .trim();
  }
  return '';
}

function readStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function readOwnerIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((p) => (p && typeof (p as { id?: unknown }).id === 'string' ? (p as { id: string }).id : ''))
    .filter((id) => id !== '');
}

function readLink(v: unknown): string {
  if (v && typeof v === 'object' && typeof (v as { link?: unknown }).link === 'string') {
    return (v as { link: string }).link.trim();
  }
  return '';
}

export function parseRecords(records: RawRecord[]): { entries: CatalogEntry[]; warnings: string[] } {
  const entries: CatalogEntry[] = [];
  const warnings: string[] = [];

  for (const { record_id: id, fields: f } of records) {
    if (f['上架'] !== true) {
      warnings.push(`记录 ${id} 未上架,已跳过`);
      continue;
    }
    const name = readText(f['名称']);
    if (!name) {
      warnings.push(`记录 ${id} 缺少名称,已跳过`);
      continue;
    }
    const category = typeof f['类型'] === 'string' ? CATEGORY_BY_LABEL.get(f['类型']) : undefined;
    if (!category) {
      warnings.push(`记录 ${id} 类型无法识别(${String(f['类型'])}),已跳过`);
      continue;
    }

    let link: string | null = null;
    const rawLink = readLink(f['跳转链接']);
    if (!rawLink) {
      warnings.push(`记录 ${id} 缺少跳转链接`);
    } else if (/^https?:\/\//i.test(rawLink)) {
      link = rawLink;
      if (category === 'agent' && !rawLink.startsWith(BOT_APPLINK_PREFIX)) {
        warnings.push(`记录 ${id} 的数字员工链接不是机器人 AppLink`);
      }
    } else {
      warnings.push(`记录 ${id} 的跳转链接不是 http(s),已忽略`);
    }

    entries.push({
      id,
      category,
      name,
      summary: readText(f['一句话简介']),
      detail: readText(f['详细说明']),
      tags: readStrings(f['标签']),
      ownerOpenIds: readOwnerIds(f['负责人']),
      link,
      order: typeof f['排序'] === 'number' ? f['排序'] : DEFAULT_ORDER,
      hot: f['热门'] === true,
    });
  }

  entries.sort(
    (a, b) =>
      CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
      a.order - b.order ||
      a.name.localeCompare(b.name, 'zh-Hans-CN'),
  );

  return { entries, warnings };
}
