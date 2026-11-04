import { readFileSync } from 'node:fs';
import type { BannerKeys, Promo } from '../cards/banners.js';
import { createCachedSource } from './cache.js';
import { readText } from './parse.js';
import { CATEGORIES } from './types.js';
import type { RawRecord } from './types.js';

/** Thrown by the promo source when no fetch has ever succeeded. */
export class PromoUnavailableError extends Error {
  constructor(message = '运营位暂不可用', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PromoUnavailableError';
  }
}

const DEFAULT_ORDER = 9999;

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** Reads a banner-keys JSON file; a missing/invalid file or field yields null for it. Never throws. */
export function loadBannerKeys(path: string): BannerKeys {
  let raw: unknown = null;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    raw = null;
  }
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const cat = (o.category && typeof o.category === 'object' ? o.category : {}) as Record<string, unknown>;
  const category = Object.fromEntries(CATEGORIES.map((c) => [c, str(cat[c])])) as BannerKeys['category'];
  return { brand: str(o.brand), category, promoDefault: str(o.promoDefault) };
}

export interface PromoRecord extends Omit<Promo, 'imgKey'> {
  imageToken: string | null;
}

/** Hyperlink cell: `{link}`, an array of segments carrying `link`, or a plain string. */
function readUrl(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) {
    for (const s of v) {
      const l = readUrl(s);
      if (l) return l;
    }
    return '';
  }
  if (v && typeof v === 'object' && typeof (v as { link?: unknown }).link === 'string') {
    return (v as { link: string }).link.trim();
  }
  return '';
}

function readImageToken(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const t = (v[0] as { file_token?: unknown } | null)?.file_token;
  return typeof t === 'string' && t !== '' ? t : null;
}

const readMs = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parsePromoRecords(records: RawRecord[]): { promos: PromoRecord[]; warnings: string[] } {
  const promos: PromoRecord[] = [];
  const warnings: string[] = [];
  for (const { record_id: id, fields: f } of records) {
    if (f['上架'] !== true) {
      warnings.push(`运营位 ${id} 未上架,已跳过`);
      continue;
    }
    const title = readText(f['标题']);
    if (!title) {
      warnings.push(`运营位 ${id} 缺少标题,已跳过`);
      continue;
    }
    let link: string | null = null;
    const rawLink = readUrl(f['跳转链接']);
    if (rawLink) {
      if (/^https?:\/\//i.test(rawLink)) link = rawLink;
      else warnings.push(`运营位 ${id} 的跳转链接不是 http(s),已忽略`);
    }
    promos.push({
      id,
      title,
      subtitle: readText(f['说明']),
      link,
      imageToken: readImageToken(f['图片']),
      start: readMs(f['开始时间']),
      end: readMs(f['结束时间']),
      order: typeof f['排序'] === 'number' ? f['排序'] : DEFAULT_ORDER,
    });
  }
  return { promos, warnings };
}

/**
 * TTL-cached promo reader; cache semantics come from createCachedSource (same as
 * the catalog source). Each attachment file_token is resolved to an img_key at
 * most once (kept across refreshes); a failed resolve gives imgKey null for that
 * promo, calls onError, and is retried on a later refresh.
 */
export function createPromoSource(opts: {
  fetchAll: () => Promise<RawRecord[]>;
  resolveImage: (fileToken: string) => Promise<string>;
  ttlMs: number;
  now?: () => number;
  maxWaitMs?: number;
  /** Hard cap per image resolve (default 2000ms); on expiry the promo gets imgKey null and the token is retried later. */
  imageTimeoutMs?: number;
  onWarnings?: (warnings: string[]) => void;
  onError?: (err: unknown) => void;
}): { get(): Promise<Promo[]> } {
  const onError = opts.onError ?? (() => {});
  const onWarnings = opts.onWarnings ?? (() => {});
  const images = new Map<string, Promise<string>>();

  function resolve(token: string): Promise<string> {
    let p = images.get(token);
    if (!p) {
      const timeoutMs = opts.imageTimeoutMs ?? 2000;
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`图片解析超时(${timeoutMs}ms)`)), timeoutMs);
        timer.unref();
      });
      let work: Promise<string>;
      try {
        work = Promise.resolve(opts.resolveImage(token));
      } catch (e) {
        work = Promise.reject(e);
      }
      p = Promise.race([work, timeout]).finally(() => clearTimeout(timer));
      images.set(token, p);
      p.catch(() => images.delete(token));
    }
    return p;
  }

  return createCachedSource(
    async () => {
      const { promos, warnings } = parsePromoRecords(await opts.fetchAll());
      onWarnings(warnings);
      return Promise.all(
        promos.map(async ({ imageToken, ...rest }): Promise<Promo> => {
          let imgKey: string | null = null;
          if (imageToken) {
            try {
              imgKey = await resolve(imageToken);
            } catch (err) {
              onError(err);
            }
          }
          return { ...rest, imgKey };
        }),
      );
    },
    {
      ttlMs: opts.ttlMs,
      now: opts.now,
      maxWaitMs: opts.maxWaitMs,
      onError: opts.onError,
      makeError: (cause) => new PromoUnavailableError('运营位暂不可用', { cause }),
    },
  );
}
