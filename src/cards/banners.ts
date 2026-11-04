import type { Category } from '../catalog/types.js';

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
