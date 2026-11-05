import { describe, expect, it } from 'vitest';
import { activePromos, bannerImg, promoBlock, type Promo } from '../../src/cards/banners.js';

describe('bannerImg', () => {
  it('is a full-bleed img with the given key and alt, preview disabled', () => {
    const i = bannerImg('img_v3_x', '数字员工') as any;
    expect(i.tag).toBe('img');
    expect(i.img_key).toBe('img_v3_x');
    expect(i.alt).toEqual({ tag: 'plain_text', content: '数字员工' });
    expect(i.scale_type).toBe('crop_center');
    expect(i.preview).toBe(false);
    expect(i.margin).toBe('-12px -12px 0px -12px');
  });
});

const promo = (over: Partial<Promo> = {}): Promo => ({
  id: 'p', title: '新上线', subtitle: '说明', link: 'https://example.com/p', imgKey: 'img_p',
  start: null, end: null, order: 1, ...over,
});

describe('activePromos', () => {
  it('keeps only promos whose window contains now, sorted by order', () => {
    const now = 1000;
    const r = activePromos(
      [
        promo({ id: 'late', order: 3 }),
        promo({ id: 'future', start: 1001, order: 0 }),
        promo({ id: 'ended', end: 1000, order: 0 }),
        promo({ id: 'starts-now', start: 1000, end: 2000, order: 2 }),
        promo({ id: 'open', start: null, end: null, order: 1 }),
      ],
      now,
    );
    expect(r.map((p) => p.id)).toEqual(['open', 'starts-now', 'late']);
  });
});

describe('promoBlock', () => {
  it('with link is a clickable accent strip with a 1:1 thumbnail', () => {
    const b = promoBlock(promo(), null) as any;
    expect(b.tag).toBe('interactive_container');
    expect(b.background_style).toBe('violet-50');
    expect(b.corner_radius).toBe('10px');
    expect(b.behaviors).toEqual([{ type: 'open_url', default_url: 'https://example.com/p' }]);
    const img = b.elements[0].columns[0].elements[0];
    expect(img.tag).toBe('img');
    expect(img.img_key).toBe('img_p');
    expect(img.scale_type).toBe('crop_center');
    const s = JSON.stringify(b);
    expect(s).toContain("<text_tag color='violet'>新上线</text_tag> **新上线**");
    expect(s).toContain('cus-muted');
  });

  it('without link is not clickable', () => {
    const b = promoBlock(promo({ link: null }), null) as any;
    expect(b.tag).toBe('column_set');
    const s = JSON.stringify(b);
    expect(s).not.toContain('open_url');
    expect(s).not.toContain('interactive_container');
    expect(s).toContain('img_p');
    expect(s).toContain('violet-50');
  });

  it('falls back to the default thumbnail, and renders text-only when there is no image at all', () => {
    expect(JSON.stringify(promoBlock(promo({ imgKey: null }), 'img_default'))).toContain('img_default');
    const s = JSON.stringify(promoBlock(promo({ imgKey: null }), null));
    expect(s).not.toContain('"tag":"img"');
    expect(s).toContain('**新上线**');
  });

  it('escapes angle brackets in title and subtitle', () => {
    const s = JSON.stringify(promoBlock(promo({ title: '<at>', subtitle: '<b>' }), null));
    expect(s).not.toContain('<at>');
    expect(s).not.toContain('<b>');
  });
});
