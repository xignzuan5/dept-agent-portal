import { readFileSync } from 'node:fs';
import * as lark from '@larksuiteoapi/node-sdk';
import { config } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { parseRecords } from '../../src/catalog/parse.js';
import { baseFetcher } from '../../src/catalog/source.js';

config();

const seed = JSON.parse(readFileSync(new URL('../../data/seed-catalog.json', import.meta.url), 'utf8')) as Array<{
  上架: boolean;
  跳转链接?: string;
}>;

describe.runIf(process.env.INTEGRATION === '1')('catalog base (integration)', () => {
  it('reads the real table; entries = listed seed rows; warnings only for the link-less and unlisted rows', async () => {
    const client = new lark.Client({
      appId: process.env.FEISHU_APP_ID!,
      appSecret: process.env.FEISHU_APP_SECRET!,
    });
    const records = await baseFetcher(client, process.env.CATALOG_APP_TOKEN!, process.env.CATALOG_TABLE_ID!)();
    expect(records).toHaveLength(seed.length);

    const { entries, warnings } = parseRecords(records);
    expect(entries).toHaveLength(seed.filter((r) => r.上架).length);
    // Seed has exactly one link-less listed row and one unlisted row; agents use bot AppLinks (no warning).
    expect(warnings).toHaveLength(2);
    expect(warnings.filter((w) => w.includes('缺少跳转链接'))).toHaveLength(1);
    expect(warnings.filter((w) => w.includes('未上架'))).toHaveLength(1);
    expect(warnings.some((w) => w.includes('AppLink'))).toBe(false);
  });
});
