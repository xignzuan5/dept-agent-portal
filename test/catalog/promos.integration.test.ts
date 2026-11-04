import * as lark from '@larksuiteoapi/node-sdk';
import { config } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { activePromos } from '../../src/cards/banners.js';
import { createImageResolver } from '../../src/catalog/images.js';
import { createPromoSource, parsePromoRecords } from '../../src/catalog/promos.js';
import { baseFetcher } from '../../src/catalog/source.js';

config();

describe.runIf(process.env.INTEGRATION === '1')('promo base (integration)', () => {
  const client = () =>
    new lark.Client({ appId: process.env.FEISHU_APP_ID!, appSecret: process.env.FEISHU_APP_SECRET! });
  const fetchAll = (c: lark.Client) => baseFetcher(c, process.env.CATALOG_APP_TOKEN!, process.env.PROMO_TABLE_ID!);

  it('reads the real 运营位 table and returns only the active promo', async () => {
    const c = client();
    const source = createPromoSource({
      fetchAll: fetchAll(c),
      resolveImage: createImageResolver(c),
      ttlMs: 60_000,
      imageTimeoutMs: 15_000,
    });
    const active = activePromos(await source.get(), Date.now());
    expect(active).toHaveLength(1);
    expect(active[0].title).toBe('新上线：报价单助手');
    expect(active[0].imgKey).toBeNull();
  }, 30_000);

  it("resolves the expired row's attachment to an IM image key", async () => {
    const c = client();
    const { promos } = parsePromoRecords(await fetchAll(c)());
    const expired = promos.find((p) => p.title === '双十一冲刺周');
    expect(expired?.imageToken).toBeTruthy();
    const key = await createImageResolver(c)(expired!.imageToken!);
    expect(key.startsWith('img_')).toBe(true);
  }, 30_000);
});
