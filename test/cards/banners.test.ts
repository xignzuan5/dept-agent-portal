import { describe, expect, it } from 'vitest';
import { bannerImg } from '../../src/cards/banners.js';

describe('bannerImg', () => {
  it('is a full-bleed img with the given key and alt, preview disabled', () => {
    const i = bannerImg('img_v3_x', '数字员工') as any;
    expect(i.tag).toBe('img');
    expect(i.img_key).toBe('img_v3_x');
    expect(i.alt).toEqual({ tag: 'plain_text', content: '数字员工' });
    expect(i.scale_type).toBe('crop_center');
    expect(i.preview).toBe(false);
    expect(i.margin).toBe('0px -12px 0px -12px');
  });
});
