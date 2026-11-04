import { CATEGORIES, CATEGORY_LABEL, type CatalogEntry } from '../catalog/types.js';
import { activePromos, bannerImg, promoBlock, type BannerKeys, type Promo } from './banners.js';
import { cardConfig } from './theme.js';
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

function metrics(entries: CatalogEntry[]): object {
  return {
    tag: 'column_set',
    flex_mode: 'none',
    horizontal_spacing: '8px',
    margin: '0px 0px 12px 0px',
    columns: CATEGORIES.map((c) => ({
      tag: 'column',
      width: 'weighted',
      weight: 1,
      background_style: 'cus-primary-bg',
      padding: '12px 4px 12px 4px',
      vertical_spacing: '2px',
      horizontal_align: 'center',
      elements: [
        {
          tag: 'markdown',
          content: `## <font color='cus-primary'>${entries.filter((e) => e.category === c).length}</font>`,
          text_align: 'center',
        },
        {
          tag: 'markdown',
          content: `<font color='cus-muted'>${CATEGORY_LABEL[c]}</font>`,
          text_align: 'center',
          text_size: 'caption',
        },
      ],
    })),
  };
}

function actions(dept: DeptInfo): object {
  const portal = {
    tag: 'button',
    text: { tag: 'plain_text', content: '打开门户' },
    type: 'primary_filled',
    width: 'fill',
    behaviors: [{ type: 'callback', value: { v: 1, a: 'open_portal' } }],
  };
  if (!dept.routerLink) return portal;
  const router = {
    tag: 'button',
    text: { tag: 'plain_text', content: '问路由助手' },
    type: 'default',
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

export function buildLobbyCard(entries: CatalogEntry[], dept: DeptInfo, extras?: LobbyExtras): object {
  const agentCount = entries.filter((e) => e.category === 'agent').length;
  const skillCount = entries.filter((e) => e.category === 'skill').length;
  const hot = pickHotAgents(entries);

  const elements: object[] = [];
  if (extras?.banners?.brand) elements.push(bannerImg(extras.banners.brand, `${dept.name}数字员工`));
  elements.push(metrics(entries));
  const promo = activePromos(extras?.promos ?? [], extras?.now ?? Date.now())[0];
  const promoEl = promo ? promoBlock(promo, extras?.banners?.promoDefault ?? null) : null;
  if (promoEl) elements.push(promoEl);
  if (hot.length > 0) {
    elements.push({
      tag: 'column_set',
      flex_mode: 'none',
      margin: '0px 0px 12px 0px',
      columns: [
        {
          tag: 'column',
          width: 'weighted',
          weight: 1,
          vertical_spacing: '8px',
          elements: [
            { tag: 'markdown', content: '**热门数字员工**' },
            ...hot.map((e) => entryTile(e)),
          ],
        },
      ],
    });
  }
  elements.push(actions(dept));

  return {
    schema: '2.0',
    config: cardConfig(),
    header: {
      title: { tag: 'plain_text', content: `${dept.name}数字员工门户` },
      subtitle: { tag: 'plain_text', content: dept.intro },
      template: 'blue',
      icon: { tag: 'standard_icon', token: 'myai_colorful' },
      text_tag_list: [
        {
          tag: 'text_tag',
          text: { tag: 'plain_text', content: `${agentCount} 个数字员工 · ${skillCount} 个 Skill` },
          color: 'blue',
        },
      ],
    },
    body: { direction: 'vertical', padding: '12px 12px 20px 12px', elements },
  };
}
