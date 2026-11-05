import type { DeptInfo } from './cards/lobby.js';

export interface PortalConfig {
  appId: string;
  appSecret: string;
  catalogAppToken: string;
  catalogTableId: string;
  promoTableId: string;
  portalChatId: string;
  dept: DeptInfo;
  personalDelivery: 'ephemeral' | 'p2p';
}

const REQUIRED: Array<[string, string]> = [
  ['FEISHU_APP_ID', 'appId'],
  ['FEISHU_APP_SECRET', 'appSecret'],
  ['CATALOG_APP_TOKEN', 'catalogAppToken'],
  ['CATALOG_TABLE_ID', 'catalogTableId'],
  ['PROMO_TABLE_ID', 'promoTableId'],
  ['PORTAL_CHAT_ID', 'portalChatId'],
  ['DEPT_NAME', 'name'],
  ['DEPT_INTRO', 'intro'],
  ['PERSONAL_DELIVERY', 'personalDelivery'],
];

/** 读取并校验环境变量;缺项时一次性列出全部缺失键。错误信息不含任何取值。 */
export function loadConfig(env: Record<string, string | undefined>): PortalConfig {
  const get = (k: string) => (env[k] ?? '').trim();
  const missing = REQUIRED.map(([k]) => k).filter((k) => !get(k));
  if (missing.length) throw new Error(`缺少环境变量:${missing.join(', ')}`);
  const mode = get('PERSONAL_DELIVERY');
  if (mode !== 'ephemeral' && mode !== 'p2p') {
    throw new Error('PERSONAL_DELIVERY 必须是 ephemeral 或 p2p');
  }
  return {
    appId: get('FEISHU_APP_ID'),
    appSecret: get('FEISHU_APP_SECRET'),
    catalogAppToken: get('CATALOG_APP_TOKEN'),
    catalogTableId: get('CATALOG_TABLE_ID'),
    promoTableId: get('PROMO_TABLE_ID'),
    portalChatId: get('PORTAL_CHAT_ID'),
    dept: { name: get('DEPT_NAME'), intro: get('DEPT_INTRO'), routerLink: get('ROUTER_LINK') || null },
    personalDelivery: mode,
  };
}
