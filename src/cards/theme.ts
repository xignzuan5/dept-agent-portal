import type { Category } from '../catalog/types.js';

const c = (light: string, dark: string) => ({ light_mode: light, dark_mode: dark });

/** 卡片全局配置:字号档位 + 深浅色自适应的自定义色板(蓝只做主操作,紫只给 Skill/新上线)。 */
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
        'cus-primary': c('rgba(30,120,255,1)', 'rgba(80,150,255,1)'),
        'cus-primary-bg': c('rgba(30,120,255,0.08)', 'rgba(80,150,255,0.14)'),
        'cus-ink': c('rgba(31,35,41,1)', 'rgba(235,238,242,1)'),
        'cus-muted': c('rgba(100,106,115,1)', 'rgba(150,155,163,1)'),
        'cus-surface': c('rgba(245,247,250,1)', 'rgba(255,255,255,0.06)'),
        'cus-line': c('rgba(31,35,41,0.08)', 'rgba(255,255,255,0.12)'),
        'cus-accent': c('rgba(102,78,255,1)', 'rgba(160,140,255,1)'),
        'cus-accent-bg': c('rgba(102,78,255,0.08)', 'rgba(160,140,255,0.16)'),
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

/** 门户 header 的当前分类标签色:数字员工蓝、Skill 紫、其余中性。 */
export const CATEGORY_TAG_COLOR: Record<Category, string> = {
  agent: 'blue',
  skill: 'violet',
  kb: 'neutral',
  service: 'neutral',
};
