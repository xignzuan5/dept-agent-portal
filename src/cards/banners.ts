import type { Category } from '../catalog/types.js';
import { safe } from './tiles.js';

export interface BannerKeys {
  brand: string | null;
  category: Record<Category, string | null>;
  promoDefault: string | null;
}

/** 通栏图:负边距抵消 body 的 12px 内边距;不可点击放大。 */
export function bannerImg(imgKey: string, alt: string): object {
  return {
    tag: 'img',
    img_key: imgKey,
    alt: { tag: 'plain_text', content: alt },
    scale_type: 'crop_center',
    preview: false,
    margin: '0px -12px 0px -12px',
  };
}

export interface Promo {
  id: string;
  title: string;
  subtitle: string;
  link: string | null;
  imgKey: string | null;
  start: number | null; // 毫秒时间戳;null 表示不限
  end: number | null;
  order: number;
}

/** 生效窗口 start <= now < end 的运营位,按 order 升序。 */
export function activePromos(promos: Promo[], now: number): Promo[] {
  return promos
    .filter((p) => (p.start === null || p.start <= now) && (p.end === null || now < p.end))
    .sort((a, b) => a.order - b.order);
}

/** 运营位:通栏图 + 加粗标题 + 灰色说明;有 link 时整块可点击。图与兜底图都没有时返回 null。 */
export function promoBlock(p: Promo, fallbackImgKey: string | null): object | null {
  const imgKey = p.imgKey ?? fallbackImgKey;
  if (!imgKey) return null;
  const inner: object[] = [
    bannerImg(imgKey, '运营位'),
    { tag: 'markdown', content: `**${safe(p.title)}**` },
    {
      tag: 'markdown',
      content: `<font color='cus-muted'>${safe(p.subtitle)}</font>`,
      text_size: 'caption',
    },
  ];
  if (p.link) {
    return {
      tag: 'interactive_container',
      width: 'fill',
      has_border: true,
      border_color: 'cus-primary-border',
      corner_radius: '8px',
      padding: '0px 12px 12px 12px',
      margin: '0px 0px 12px 0px',
      vertical_spacing: '4px',
      behaviors: [{ type: 'open_url', default_url: p.link }],
      elements: inner,
    };
  }
  return {
    tag: 'column_set',
    flex_mode: 'none',
    margin: '0px 0px 12px 0px',
    columns: [
      {
        tag: 'column',
        width: 'weighted',
        weight: 1,
        padding: '0px 12px 12px 12px',
        vertical_spacing: '4px',
        background_style: 'cus-primary-bg',
        elements: inner,
      },
    ],
  };
}
