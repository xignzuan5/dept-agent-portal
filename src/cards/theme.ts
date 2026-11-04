import type { Category } from '../catalog/types.js';

/** 卡片全局配置:字号档位 + 深浅色自适应的自定义色板。 */
export function cardConfig(): object {
  return {
    update_multi: true,
    width_mode: 'default',
    style: {
      text_size: {
        title: { default: 'heading-2', pc: 'heading-2', mobile: 'heading-3' },
        body: { default: 'normal', pc: 'normal', mobile: 'normal' },
        caption: { default: 'notation', pc: 'notation', mobile: 'notation' },
      },
      color: {
        'cus-primary': { light_mode: 'rgba(30,120,255,1)', dark_mode: 'rgba(80,150,255,1)' },
        'cus-primary-bg': { light_mode: 'rgba(30,120,255,0.08)', dark_mode: 'rgba(80,150,255,0.12)' },
        'cus-muted': { light_mode: 'rgba(100,106,115,1)', dark_mode: 'rgba(150,155,163,1)' },
      },
    },
  };
}

/** 取自 resource/icons.md 的彩色 standard_icon token。 */
export const CATEGORY_ICON: Record<Category, string> = {
  agent: 'myai_colorful',
  skill: 'ai-common_colorful',
  kb: 'wiki-bitable_colorful',
  service: 'approval_colorful',
};
