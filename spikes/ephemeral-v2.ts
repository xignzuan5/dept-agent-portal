import 'dotenv/config';
import * as lark from '@larksuiteoapi/node-sdk';
import { appendFileSync, mkdirSync } from 'node:fs';

const { FEISHU_APP_ID, FEISHU_APP_SECRET, PORTAL_CHAT_ID, SPIKE_OPEN_ID } = process.env as Record<string, string>;
for (const [k, v] of Object.entries({ FEISHU_APP_ID, FEISHU_APP_SECRET, PORTAL_CHAT_ID, SPIKE_OPEN_ID })) {
  if (!v) throw new Error(`missing env ${k}`);
}

const OUT_DIR = new URL('./out/', import.meta.url).pathname;
const OUT_FILE = OUT_DIR + 'callbacks.ndjson';
mkdirSync(OUT_DIR, { recursive: true });

const client = new lark.Client({ appId: FEISHU_APP_ID, appSecret: FEISHU_APP_SECRET });
const counters: Record<string, number> = { ephemeral: 0, p2p: 0 };

function buildCard(v: 'ephemeral' | 'p2p', subtitle: string) {
  const cb = (w: string) => [{ type: 'callback', value: { a: 'spike', w, v } }];
  return {
    schema: '2.0',
    config: { update_multi: true },
    header: {
      title: { tag: 'plain_text', content: '门户技术验证' },
      subtitle: { tag: 'plain_text', content: subtitle },
      template: 'blue',
    },
    body: {
      elements: [
        {
          tag: 'interactive_container',
          width: 'fill',
          height: 'auto',
          padding: '12px',
          behaviors: cb('container'),
          elements: [{ tag: 'markdown', content: `**可点击区块**（${v}）` }],
        },
        {
          tag: 'collapsible_panel',
          expanded: false,
          header: { title: { tag: 'markdown', content: '**折叠面板**' } },
          elements: [{ tag: 'markdown', content: '面板内的 markdown 内容' }],
        },
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '点我' },
          type: 'primary',
          behaviors: cb('button'),
        },
        {
          tag: 'input',
          name: 'spike_input',
          placeholder: { tag: 'plain_text', content: '输入后回车' },
          behaviors: cb('input'),
        },
      ],
    },
  };
}

function summarize(e: any): string {
  const f = (x: unknown) => (x === undefined || x === null || x === '' ? '<missing>' : typeof x === 'string' ? x : JSON.stringify(x));
  return [
    `operator.open_id=${f(e?.operator?.open_id)}`,
    `context.open_chat_id=${f(e?.context?.open_chat_id)}`,
    `context.open_message_id=${f(e?.context?.open_message_id)}`,
    `action.value=${f(e?.action?.value)}`,
    `action.input_value=${f(e?.action?.input_value)}`,
  ].join(' ');
}

const dispatcher = new lark.EventDispatcher({}).register({
  'card.action.trigger': async (data: any) => {
    try {
      appendFileSync(OUT_FILE, JSON.stringify(data) + '\n');
      const v: 'ephemeral' | 'p2p' = data?.action?.value?.v === 'p2p' ? 'p2p' : 'ephemeral';
      counters[v]++;
      console.log(`[callback] v=${v} n=${counters[v]} ${summarize(data)}`);
      return {
        toast: { type: 'success', content: '已更新' },
        card: { type: 'raw', data: buildCard(v, `第 ${counters[v]} 次点击（${v}）`) },
      };
    } catch (err) {
      console.error('[callback] handler error', err);
      return { toast: { type: 'error', content: '处理失败' } };
    }
  },
} as any);

const ws = new lark.WSClient({ appId: FEISHU_APP_ID, appSecret: FEISHU_APP_SECRET });
await ws.start({ eventDispatcher: dispatcher });
console.log('[ws] started');

function logErr(label: string, err: any) {
  const body = err?.response?.data ?? err?.message ?? err;
  console.error(`[send:${label}] FAILED`, JSON.stringify(body));
}

try {
  const r: any = await client.request({
    method: 'POST',
    url: '/open-apis/ephemeral/v1/send',
    data: { chat_id: PORTAL_CHAT_ID, open_id: SPIKE_OPEN_ID, msg_type: 'interactive', card: buildCard('ephemeral', '初始（ephemeral）') },
  });
  console.log(`[send:ephemeral] code=${r?.code} msg=${r?.msg} message_id=${r?.data?.message_id ?? '<missing>'}`);
} catch (err) {
  logErr('ephemeral', err);
}

try {
  const r: any = await client.im.v1.message.create({
    params: { receive_id_type: 'open_id' },
    data: { receive_id: SPIKE_OPEN_ID, msg_type: 'interactive', content: JSON.stringify(buildCard('p2p', '初始（p2p）')) },
  });
  console.log(`[send:p2p] code=${r?.code} msg=${r?.msg} message_id=${r?.data?.message_id ?? '<missing>'}`);
} catch (err) {
  logErr('p2p', err);
}

console.log('SPIKE READY');
const stop = () => { console.log('[spike] stopping'); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
