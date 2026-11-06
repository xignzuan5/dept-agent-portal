import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { cardBytes, countElements, MAX_BYTES, MAX_ELEMENTS } from '../src/cards/budget.js';
import { buildLobbyCard } from '../src/cards/lobby.js';
import { buildPortalCard } from '../src/cards/portal.js';
import { parseRecords } from '../src/catalog/parse.js';
import { loadBannerKeys } from '../src/catalog/promos.js';
import { CATEGORIES } from '../src/catalog/types.js';

const defaults = parse(readFileSync('.env.example'));
const dept = {
  name: process.env.DEPT_NAME?.trim() || defaults.DEPT_NAME,
  intro: process.env.DEPT_INTRO?.trim() || defaults.DEPT_INTRO,
  routerLink: null,
};
const seedPath = 'data/seed-catalog.json';
const seed: unknown = JSON.parse(readFileSync(seedPath, 'utf8'));
if (!Array.isArray(seed) || seed.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
  throw new Error(`${seedPath} 必须是由目录记录对象组成的 JSON 数组`);
}

const { entries, warnings } = parseRecords(seed.map((row, i) => ({
  record_id: `sample-${i + 1}`,
  fields: {
    ...row,
    '跳转链接': typeof row['跳转链接'] === 'string' ? { link: row['跳转链接'] } : row['跳转链接'],
  },
})));
if (warnings.length) console.warn(warnings.join('\n'));
if (!entries.length) throw new Error(`${seedPath} 没有可用的上架记录`);

const banners = loadBannerKeys('data/banner-keys.json');
const cards = {
  lobby: buildLobbyCard(entries, dept, { banners }),
  ...Object.fromEntries(CATEGORIES.map((category) => [
    `portal-${category}`,
    buildPortalCard(entries, { category, page: 0, query: '' }, dept, banners).card,
  ])),
};

for (const [name, card] of Object.entries(cards)) {
  const bytes = cardBytes(card);
  const elements = countElements(card);
  if (bytes > MAX_BYTES || elements > MAX_ELEMENTS) {
    throw new Error(`${name}: ${bytes}/${MAX_BYTES} 字节，${elements}/${MAX_ELEMENTS} 个元素，已超出卡片上限`);
  }
}
mkdirSync('dist/cards', { recursive: true });
for (const [name, card] of Object.entries(cards)) {
  const path = `dist/cards/${name}.json`;
  writeFileSync(path, JSON.stringify(card, null, 2) + '\n');
  console.log(path);
}
