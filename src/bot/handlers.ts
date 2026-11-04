import { CatalogUnavailableError, type CatalogSource } from '../catalog/source.js';
import type { Category } from '../catalog/types.js';
import type { BannerKeys } from '../cards/banners.js';
import type { DeptInfo } from '../cards/lobby.js';
import { buildPortalCard } from '../cards/portal.js';
import { decodeAction } from './actions.js';

type Target = { chatId: string; openId: string; chatType: 'p2p' | 'group' };

export interface Deliverer {
  personalPortal(target: Target, card: object): Promise<{ via: 'ephemeral' | 'p2p' }>;
}

export interface HandlerDeps {
  catalog: CatalogSource;
  dept: DeptInfo;
  deliver: Deliverer;
  banners?: BannerKeys;
  onError?: (err: unknown) => void;
}

export interface CardActionInput {
  operatorOpenId: string;
  chatId: string;
  chatType: 'p2p' | 'group';
  value: unknown;
  inputValue?: string;
}

export interface CallbackResult {
  toast?: { type: 'info' | 'success' | 'error' | 'warning'; content: string };
  card?: { type: 'raw'; data: object };
}

const DELIVERY_TIMEOUT_MS = 2000;
const MAX_QUERY_CHARS = 50;

const toast = (type: 'success' | 'error' | 'warning', content: string): CallbackResult => ({
  toast: { type, content },
});

function cleanQuery(q: string): string {
  return Array.from(q.trim()).slice(0, MAX_QUERY_CHARS).join('');
}

function report(deps: HandlerDeps, err: unknown): void {
  try {
    deps.onError?.(err);
  } catch {
    /* onError 自身出错不应影响回调响应 */
  }
}

class DeliveryTimeout extends Error {
  constructor() {
    super(`门户投递超过 ${DELIVERY_TIMEOUT_MS}ms`);
    this.name = 'DeliveryTimeout';
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeliveryTimeout()), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function openPortal(target: Target, deps: HandlerDeps): Promise<CallbackResult> {
  try {
    const entries = await deps.catalog.get();
    const { card } = buildPortalCard(entries, { category: 'agent', page: 0, query: '' }, deps.dept, deps.banners);
    let via: 'ephemeral' | 'p2p';
    try {
      ({ via } = await withTimeout(deps.deliver.personalPortal(target, card), DELIVERY_TIMEOUT_MS));
    } catch (err) {
      report(deps, err);
      return toast('error', '门户发送失败,请稍后再试');
    }
    return toast('success', via === 'p2p' ? '已在私聊打开门户' : '门户已发给你(仅你可见)');
  } catch (err) {
    if (err instanceof CatalogUnavailableError) return toast('error', '目录暂时读不到,请稍后再试');
    report(deps, err);
    return toast('error', '出了点问题,请稍后再试');
  }
}

async function portalCard(deps: HandlerDeps, category: Category, page: number, query: string): Promise<CallbackResult> {
  const entries = await deps.catalog.get();
  const { card } = buildPortalCard(entries, { category, page, query: cleanQuery(query) }, deps.dept, deps.banners);
  return { card: { type: 'raw', data: card } };
}

export async function handleCardAction(evt: CardActionInput, deps: HandlerDeps): Promise<CallbackResult> {
  const action = decodeAction(evt.value);
  if (!action) return toast('warning', '卡片已过期,请重新打开门户');
  try {
    switch (action.a) {
      case 'open_portal':
        return await openPortal({ chatId: evt.chatId, openId: evt.operatorOpenId, chatType: evt.chatType }, deps);
      case 'nav':
        return await portalCard(deps, action.cat, action.page, action.q);
      case 'search':
        return await portalCard(deps, action.cat, 0, evt.inputValue ?? '');
    }
  } catch (err) {
    if (err instanceof CatalogUnavailableError) return toast('error', '目录暂时读不到,请稍后再试');
    report(deps, err);
    return toast('error', '出了点问题,请稍后再试');
  }
}
