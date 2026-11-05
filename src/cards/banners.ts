import type { Category } from '../catalog/types.js';
import { CATEGORY_COLOR, muted, shade } from './theme.js';
import { safe } from './tiles.js';

export interface BannerKeys {
  brand: string | null;
  category: Record<Category, string | null>;
  /** 1:1 缩略图兜底(运营横条用)。 */
  promoDefault: string | null;
  /** 每分类一个透明底图标(入口格 / 磁贴 / Skill 面板头);缺失为 null,退回 standard_icon。 */
  icons: Record<Category, string | null>;
}

/** 通栏图:负边距抵消 body 的 12px 内边距,顶部与 header 贴合;不可点击放大。 */
export function bannerImg(imgKey: string, alt: string): object {
  return {
    tag: 'img',
    img_key: imgKey,
    alt: { tag: 'plain_text', content: alt },
    scale_type: 'crop_center',
    preview: false,
    margin: '-12px -12px 0px -12px',
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

/** 运营横条:左 1:1 缩略图 + 右「新上线」标签/标题/说明;有 link 时整条可点击。 */
export function promoBlock(p: Promo, fallbackImgKey: string | null): object {
  const imgKey = p.imgKey ?? fallbackImgKey;
  const columns: object[] = [];
  if (imgKey) {
    columns.push({
      tag: 'column',
      width: 'auto',
      vertical_align: 'center',
      elements: [
        {
          tag: 'img',
          img_key: imgKey,
          alt: { tag: 'plain_text', content: '运营位' },
          scale_type: 'crop_center',
          size: '64px 64px',
          corner_radius: '8px',
          preview: false,
        },
      ],
    });
  }
  columns.push({
    tag: 'column',
    width: 'weighted',
    weight: 1,
    vertical_align: 'center',
    vertical_spacing: '2px',
    elements: [
      { tag: 'markdown', content: `<text_tag color='${CATEGORY_COLOR.skill}'>新上线</text_tag> **${safe(p.title)}**` },
      { tag: 'markdown', content: muted(safe(p.subtitle)), text_size: 'caption' },
    ],
  });
  const row = { tag: 'column_set', flex_mode: 'none', horizontal_spacing: '12px', columns };
  if (p.link) {
    return {
      tag: 'interactive_container',
      width: 'fill',
      background_style: shade('skill', 50),
      corner_radius: '10px',
      padding: '12px 12px 12px 12px',
      behaviors: [{ type: 'open_url', default_url: p.link }],
      elements: [row],
    };
  }
  // 无链接:不可点;column 不支持圆角,只给底色
  return {
    tag: 'column_set',
    flex_mode: 'none',
    columns: [
      {
        tag: 'column',
        width: 'weighted',
        weight: 1,
        background_style: shade('skill', 50),
        padding: '12px 12px 12px 12px',
        elements: [row],
      },
    ],
  };
}
