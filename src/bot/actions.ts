import { CATEGORIES, type Category } from '../catalog/types.js';

export type PortalAction =
  | { v: 1; a: 'open_portal'; cat?: Category }
  | { v: 1; a: 'nav'; cat: Category; page: number; q: string }
  | { v: 1; a: 'search'; cat: Category };

function isCategory(x: unknown): x is Category {
  return typeof x === 'string' && (CATEGORIES as string[]).includes(x);
}

/** 解码卡片回调的 value(对象或 JSON 字符串);任何字段不合法都返回 null。 */
export function decodeAction(value: unknown): PortalAction | null {
  let o: unknown = value;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  if (r.v !== 1) return null;
  switch (r.a) {
    case 'open_portal':
      return isCategory(r.cat) ? { v: 1, a: 'open_portal', cat: r.cat } : { v: 1, a: 'open_portal' };
    case 'nav': {
      if (!isCategory(r.cat)) return null;
      if (typeof r.page !== 'number' || !Number.isInteger(r.page) || r.page < 0) return null;
      if (r.q !== undefined && typeof r.q !== 'string') return null;
      return { v: 1, a: 'nav', cat: r.cat, page: r.page, q: r.q ?? '' };
    }
    case 'search':
      return isCategory(r.cat) ? { v: 1, a: 'search', cat: r.cat } : null;
    default:
      return null;
  }
}
