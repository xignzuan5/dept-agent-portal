import 'dotenv/config';
import * as lark from '@larksuiteoapi/node-sdk';
import { loadConfig } from '../config.js';
import { baseFetcher, createCatalogSource } from '../catalog/source.js';
import { loadBannerKeys } from '../catalog/promos.js';
import { createDeliverer } from './deliver.js';
import { handleCardAction, openPortal, type CallbackResult, type HandlerDeps } from './handlers.js';
import { createSeenSet, isPortalCommand, mentionsBot } from './intent.js';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const config = loadConfig(process.env);
const client = new lark.Client({ appId: config.appId, appSecret: config.appSecret });

const catalog = createCatalogSource({
  fetchAll: baseFetcher(client, config.catalogAppToken, config.catalogTableId),
  ttlMs: 60_000,
  onWarnings: (w) => w.length && console.warn(`[catalog] 数据警告 ${w.length} 条: ${w.join(' | ')}`),
  onError: (e) => console.error(`[catalog] 读取失败: ${errMsg(e)}`),
});

const deps: HandlerDeps = {
  catalog,
  dept: config.dept,
  deliver: createDeliverer(client, config.personalDelivery),
  banners: loadBannerKeys('data/banner-keys.json'),
  onError: (e) => console.error(`[handler] ${errMsg(e)}`),
};

async function fetchBotOpenId(): Promise<string> {
  try {
    const res = (await client.request({ method: 'GET', url: '/open-apis/bot/v3/info' })) as {
      bot?: { open_id?: string };
    };
    return res?.bot?.open_id ?? '';
  } catch (e) {
    console.error(`[startup] 获取机器人 open_id 失败,群内 @ 触发将不可用: ${errMsg(e)}`);
    return '';
  }
}

const firstMessage = createSeenSet();
const firstMenuEvent = createSeenSet();

async function triggerPortal(openId: string, chatId: string, chatType: 'p2p' | 'group', src: string) {
  const r = await openPortal({ chatId, openId, chatType }, deps);
  if (r.toast?.type !== 'success') console.error(`[${src}] 打开门户未成功: ${r.toast?.content ?? '未知'}`);
  else console.log(`[${src}] 已投递门户`);
}

try {
  await catalog.get();
} catch (e) {
  console.error(`[startup] 目录预热失败(继续启动): ${errMsg(e)}`);
}
const botOpenId = await fetchBotOpenId();

const dispatcher = new lark.EventDispatcher({}).register({
  'card.action.trigger': async (data: any): Promise<CallbackResult> => {
    const operatorOpenId: string | undefined = data?.operator?.open_id;
    const chatId: string | undefined = data?.context?.open_chat_id;
    if (!operatorOpenId || !chatId) return { toast: { type: 'warning', content: '无法识别操作人,请重新打开门户' } };
    try {
      return await handleCardAction(
        {
          operatorOpenId,
          chatId,
          chatType: chatId === config.portalChatId ? 'group' : 'p2p',
          value: data?.action?.value,
          inputValue: data?.action?.input_value,
        },
        deps,
      );
    } catch (e) {
      console.error(`[card] ${errMsg(e)}`);
      return { toast: { type: 'error', content: '出了点问题,请稍后再试' } };
    }
  },
  'im.message.receive_v1': async (data: any) => {
    try {
      const { sender, message } = data;
      if (sender.sender_type !== 'user' || message.message_type !== 'text') return;
      const openId = sender.sender_id?.open_id;
      if (!openId) return;
      const chatType = message.chat_type === 'p2p' ? 'p2p' : 'group';
      if (chatType === 'group' && !mentionsBot(message.mentions, botOpenId)) return;
      let text = '';
      try {
        text = String(JSON.parse(message.content)?.text ?? '');
      } catch {
        return;
      }
      if (!isPortalCommand(text)) return;
      if (!firstMessage(message.message_id)) return;
      // 立即返回以尽快 ack;投递失败不会因重投而重试,用户重新发指令即可
      void triggerPortal(openId, message.chat_id, chatType, `msg:${chatType}`).catch((e) => console.error(`[msg] ${errMsg(e)}`));
    } catch (e) {
      console.error(`[msg] ${errMsg(e)}`);
    }
  },
  'application.bot.menu_v6': async (data: any) => {
    try {
      if (data.event_key !== 'open_portal') return;
      const openId = data.operator?.operator_id?.open_id;
      if (!openId) return;
      if (data.event_id && !firstMenuEvent(data.event_id)) return;
      // 立即返回以尽快 ack;投递失败不会因重投而重试,用户重新点菜单即可
      void triggerPortal(openId, '', 'p2p', 'menu').catch((e) => console.error(`[menu] ${errMsg(e)}`));
    } catch (e) {
      console.error(`[menu] ${errMsg(e)}`);
    }
  },
} as any);

const ws = new lark.WSClient({ appId: config.appId, appSecret: config.appSecret });
await ws.start({ eventDispatcher: dispatcher });
console.log('portal bot ready');

const stop = () => {
  try {
    ws.close();
  } catch {
    /* ignore */
  }
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
