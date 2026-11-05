import { createReadStream, existsSync, writeFileSync } from 'node:fs';
import * as lark from '@larksuiteoapi/node-sdk';
import { config } from 'dotenv';

config();

const client = new lark.Client({ appId: process.env.FEISHU_APP_ID!, appSecret: process.env.FEISHU_APP_SECRET! });

async function upload(rel: string): Promise<string> {
  const res = (await client.im.v1.image.create({
    data: { image_type: 'message', image: createReadStream(new URL(`../${rel}`, import.meta.url)) },
  })) as { image_key?: string } | null;
  if (!res?.image_key) throw new Error(`上传 ${rel} 失败`);
  return res.image_key;
}

/** 分类图标:文件存在才上传,缺失为 null(卡片退回 standard_icon)。 */
async function uploadIcon(cat: string): Promise<string | null> {
  const rel = `assets/icons/${cat}.png`;
  return existsSync(new URL(`../${rel}`, import.meta.url)) ? upload(rel) : null;
}

const keys = {
  brand: await upload('assets/banners/brand.png'),
  category: {
    agent: await upload('assets/banners/cat-agent.png'),
    skill: await upload('assets/banners/cat-skill.png'),
    kb: await upload('assets/banners/cat-kb.png'),
    service: await upload('assets/banners/cat-service.png'),
  },
  promoDefault: await upload('assets/banners/promo-default.png'),
  icons: {
    agent: await uploadIcon('agent'),
    skill: await uploadIcon('skill'),
    kb: await uploadIcon('kb'),
    service: await uploadIcon('service'),
  },
};
writeFileSync(new URL('../data/banner-keys.json', import.meta.url), JSON.stringify(keys, null, 2) + '\n');
console.log('wrote data/banner-keys.json');
