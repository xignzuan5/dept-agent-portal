import type { Category } from '../catalog/types.js';

const c = (light: string, dark: string) => ({ light_mode: light, dark_mode: dark });

/** 卡片全局配置:字号档位 + 深浅色自适应的自定义色板(ink/muted;分类色直接用飞书枚举色,见 CATEGORY_COLOR)。 */
export function cardConfig(): object {
  return {
    update_multi: true,
    width_mode: 'default',
    style: {
      text_size: {
        title: { default: 'heading-3', pc: 'heading-3', mobile: 'heading-4' },
        body: { default: 'normal', pc: 'normal', mobile: 'normal' },
        caption: { default: 'notation', pc: 'notation', mobile: 'notation' },
      },
      color: {
        'cus-ink': c('rgba(31,35,41,1)', 'rgba(235,238,242,1)'),
        'cus-muted': c('rgba(100,106,115,1)', 'rgba(150,155,163,1)'),
      },
    },
  };
}

/** 取自 resource/icons.md 的彩色 standard_icon token;分类图标缺失时的兜底。 */
export const CATEGORY_ICON: Record<Category, string> = {
  agent: 'myai_colorful',
  skill: 'ai-common_colorful',
  kb: 'wiki-bitable_colorful',
  service: 'approval_colorful',
};

/** 分类图标:有上传的 img_key 用 custom_icon,否则退回 standard_icon。 */
export function categoryIcon(cat: Category, imgKey: string | null | undefined): object {
  return imgKey
    ? { tag: 'custom_icon', img_key: imgKey }
    : { tag: 'standard_icon', token: CATEGORY_ICON[cat] };
}

/** 灰字(正文/辅助信息),可选 caption 字号由调用方的 text_size 决定。 */
export const muted = (s: string): string => `<font color='cus-muted'>${s}</font>`;

/** 分类色(全局固定,同色同义):全部来自飞书枚举色,深色模式由客户端适配。 */
export const CATEGORY_COLOR: Record<Category, 'blue' | 'violet' | 'turquoise' | 'orange'> = {
  agent: 'blue',
  skill: 'violet',
  kb: 'turquoise',
  service: 'orange',
};

/** 分类色的某一档,如 shade('agent', 50) -> 'blue-50'。 */
export const shade = (cat: Category, n: 50 | 100 | 500): string => `${CATEGORY_COLOR[cat]}-${n}`;

/** 白字(实心彩块上)。 */
export const white = (s: string): string => `<font color='white'>${s}</font>`;
