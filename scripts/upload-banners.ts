import { createReadStream, writeFileSync } from 'node:fs';
import * as lark from '@larksuiteoapi/node-sdk';
import { config } from 'dotenv';

config();

const client = new lark.Client({ appId: process.env.FEISHU_APP_ID!, appSecret: process.env.FEISHU_APP_SECRET! });

async function upload(name: string): Promise<string> {
  const res = (await client.im.v1.image.create({
    data: { image_type: 'message', image: createReadStream(new URL(`../assets/banners/${name}.png`, import.meta.url)) },
  })) as { image_key?: string } | null;
  if (!res?.image_key) throw new Error(`上传 ${name} 失败`);
  return res.image_key;
}

const keys = {
  brand: await upload('brand'),
  category: {
    agent: await upload('cat-agent'),
    skill: await upload('cat-skill'),
    kb: await upload('cat-kb'),
    service: await upload('cat-service'),
  },
  promoDefault: await upload('promo-default'),
};
writeFileSync(new URL('../data/banner-keys.json', import.meta.url), JSON.stringify(keys, null, 2) + '\n');
console.log('wrote data/banner-keys.json');
