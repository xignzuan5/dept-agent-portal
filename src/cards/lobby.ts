import { CATEGORIES, CATEGORY_LABEL, type Category, type CatalogEntry } from '../catalog/types.js';
import { activePromos, bannerImg, promoBlock, type BannerKeys, type Promo } from './banners.js';
import { cardConfig, categoryIcon, muted } from './theme.js';
import { entryTile } from './tiles.js';

export interface DeptInfo {
  name: string;
  intro: string;
  routerLink: string | null;
}

export interface LobbyExtras {
  banners?: BannerKeys;
  promos?: Promo[];
  now?: number;
}

const HOT_LIMIT = 4;

function pickHotAgents(entries: CatalogEntry[]): CatalogEntry[] {
  const agents = entries.filter((e) => e.category === 'agent').sort((a, b) => a.order - b.order);
  const hot = agents.filter((e) => e.hot).slice(0, HOT_LIMIT);
  if (hot.length >= HOT_LIMIT) return hot;
  const rest = agents.filter((e) => !e.hot).slice(0, HOT_LIMIT - hot.length);
  return [...hot, ...rest];
}

const CATEGORY_BLURB: Record<Category, string> = {
  agent: '帮你干活的 AI 同事',
  skill: '即装即用的销售技能',
  kb: '产品、报价、案例一处查',
  service: '审批与售前支持',
};

/** 单个入口格:点击发 open_portal + cat,直达该分类。 */
function entryCell(c: Category, count: number, iconKey: string | null): object {
  return {
    tag: 'interactive_container',
    width: 'fill',
    background_style: 'cus-surface',
    has_border: true,
    border_color: 'cus-line',
    corner_radius: '10px',
    padding: '12px 12px 12px 12px',
    vertical_spacing: '4px',
    behaviors: [{ type: 'callback', value: { v: 1, a: 'open_portal', cat: c } }],
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**<font color='cus-ink'>${CATEGORY_LABEL[c]}</font>** ${muted(String(count))}`,
        },
        icon: categoryIcon(c, iconKey),
      },
      { tag: 'markdown', content: muted(CATEGORY_BLURB[c]), text_size: 'caption' },
    ],
  };
}

/** 2×2 入口格:两个 column_set,每个两列。 */
function entryGrid(entries: CatalogEntry[], icons: BannerKeys['icons'] | undefined): object[] {
  const row = (cats: Category[], first: boolean): object => ({
    tag: 'column_set',
    flex_mode: 'none',
    horizontal_spacing: '8px',
    // body 间距 12px,两行之间只要 8px
    ...(first ? {} : { margin: '-4px 0px 0px 0px' }),
    columns: cats.map((c) => ({
      tag: 'column',
      width: 'weighted',
      weight: 1,
      elements: [entryCell(c, entries.filter((e) => e.category === c).length, icons?.[c] ?? null)],
    })),
  });
  return [row(CATEGORIES.slice(0, 2), true), row(CATEGORIES.slice(2, 4), false)];
}

function actions(dept: DeptInfo): object {
  const portal = {
    tag: 'button',
    text: { tag: 'plain_text', content: '打开门户' },
    type: 'primary_filled',
    size: 'large',
    width: 'fill',
    behaviors: [{ type: 'callback', value: { v: 1, a: 'open_portal' } }],
  };
  if (!dept.routerLink) return portal;
  const router = {
    tag: 'button',
    text: { tag: 'plain_text', content: '问路由助手' },
    type: 'default',
    size: 'large',
    width: 'fill',
    behaviors: [{ type: 'open_url', default_url: dept.routerLink }],
  };
  return {
    tag: 'column_set',
    flex_mode: 'none',
    horizontal_spacing: '8px',
    columns: [portal, router].map((b) => ({
      tag: 'column',
      width: 'weighted',
      weight: 1,
      elements: [b],
    })),
  };
}

function hotSection(hot: CatalogEntry[], agentCount: number, icons: BannerKeys['icons'] | undefined): object {
  return {
    tag: 'column_set',
    flex_mode: 'none',
    columns: [
      {
        tag: 'column',
        width: 'weighted',
        weight: 1,
        vertical_spacing: '8px',
        elements: [
          {
            tag: 'column_set',
            flex_mode: 'none',
            columns: [
              {
                tag: 'column',
                width: 'weighted',
                weight: 1,
                vertical_align: 'center',
                elements: [{ tag: 'markdown', content: '热门数字员工', text_size: 'title' }],
              },
              {
                tag: 'column',
                width: 'auto',
                vertical_align: 'center',
                elements: [
                  {
                    tag: 'button',
                    text: { tag: 'plain_text', content: `全部 ${agentCount} 个 →` },
                    type: 'text',
                    size: 'small',
                    behaviors: [{ type: 'callback', value: { v: 1, a: 'open_portal', cat: 'agent' } }],
                  },
                ],
              },
            ],
          },
          ...hot.map((e) => entryTile(e, icons?.agent ?? null)),
        ],
      },
    ],
  };
}

export function buildLobbyCard(entries: CatalogEntry[], dept: DeptInfo, extras?: LobbyExtras): object {
  const agentCount = entries.filter((e) => e.category === 'agent').length;
  const hot = pickHotAgents(entries);
  const icons = extras?.banners?.icons;

  const elements: object[] = [];
  if (extras?.banners?.brand) elements.push(bannerImg(extras.banners.brand, `${dept.name}数字员工`));
  elements.push(...entryGrid(entries, icons), actions(dept));
  if (hot.length > 0) elements.push(hotSection(hot, agentCount, icons));
  const promo = activePromos(extras?.promos ?? [], extras?.now ?? Date.now())[0];
  if (promo) elements.push(promoBlock(promo, extras?.banners?.promoDefault ?? null));

  return {
    schema: '2.0',
    config: cardConfig(),
    header: {
      title: { tag: 'plain_text', content: `${dept.name}数字员工门户` },
      subtitle: { tag: 'plain_text', content: dept.intro },
      template: 'blue',
      icon: { tag: 'standard_icon', token: 'myai_colorful' },
    },
    body: { direction: 'vertical', padding: '12px 12px 20px 12px', vertical_spacing: '12px', elements },
  };
}
