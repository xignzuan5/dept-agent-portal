import * as lark from '@larksuiteoapi/node-sdk';
import type { Deliverer } from './handlers.js';

function assertOk(res: { code?: number; msg?: string } | undefined, what: string): void {
  if (res?.code !== undefined && res.code !== 0) throw new Error(`${what}失败:code=${res.code} msg=${res.msg ?? ''}`);
}

export function createDeliverer(client: lark.Client, mode: 'ephemeral' | 'p2p'): Deliverer {
  return {
    async personalPortal(target, card) {
      if (target.chatType === 'p2p' || mode === 'p2p') {
        const res = await client.im.v1.message.create({
          params: { receive_id_type: 'open_id' },
          data: { receive_id: target.openId, msg_type: 'interactive', content: JSON.stringify(card) },
        });
        assertOk(res, '私聊发送门户');
        return { via: 'p2p' };
      }
      const res = (await client.request({
        method: 'POST',
        url: '/open-apis/ephemeral/v1/send',
        data: { chat_id: target.chatId, open_id: target.openId, msg_type: 'interactive', card },
      })) as { code?: number; msg?: string };
      assertOk(res, '群内临时卡发送');
      return { via: 'ephemeral' };
    },
  };
}
