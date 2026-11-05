import 'dotenv/config';
import * as lark from '@larksuiteoapi/node-sdk';
import { loadConfig } from '../src/config.js';
import { baseFetcher, createCatalogSource } from '../src/catalog/source.js';
import { createPromoSource, loadBannerKeys } from '../src/catalog/promos.js';
import { createImageResolver } from '../src/catalog/images.js';
import { buildLobbyCard } from '../src/cards/lobby.js';
import { MAX_BYTES, cardBytes } from '../src/cards/budget.js';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function main() {
  const config = loadConfig(process.env);
  const client = new lark.Client({ appId: config.appId, appSecret: config.appSecret });

  const catalog = createCatalogSource({
    fetchAll: baseFetcher(client, config.catalogAppToken, config.catalogTableId),
    ttlMs: 60_000,
    onWarnings: (w) => w.length && console.warn(`[catalog] 数据警告: ${w.join(' | ')}`),
    onError: (e) => console.error(`[catalog] ${errMsg(e)}`),
  });
  const entries = await catalog.get();

  let promos: Awaited<ReturnType<ReturnType<typeof createPromoSource>['get']>> = [];
  try {
    const promoSource = createPromoSource({
      fetchAll: baseFetcher(client, config.catalogAppToken, config.promoTableId),
      resolveImage: createImageResolver(client),
      ttlMs: 60_000,
      onWarnings: (w) => w.length && console.warn(`[promo] 数据警告: ${w.join(' | ')}`),
      onError: (e) => console.error(`[promo] ${errMsg(e)}`),
    });
    promos = await promoSource.get();
  } catch (e) {
    console.error(`[promo] 运营位读取失败,继续发送不带运营位的大厅卡: ${errMsg(e)}`);
  }

  const card = buildLobbyCard(entries, config.dept, {
    banners: loadBannerKeys('data/banner-keys.json'),
    promos,
    now: Date.now(),
  });
  const bytes = cardBytes(card);
  if (bytes > MAX_BYTES) throw new Error(`大厅卡 ${bytes} 字节,超过 ${MAX_BYTES} 上限`);

  const sent = await client.im.v1.message.create({
    params: { receive_id_type: 'chat_id' },
    data: { receive_id: config.portalChatId, msg_type: 'interactive', content: JSON.stringify(card) },
  });
  if (sent.code !== 0 || !sent.data?.message_id) throw new Error(`发送大厅卡失败:code=${sent.code} msg=${sent.msg ?? ''}`);
  const messageId = sent.data.message_id;

  const pinned = await client.im.v1.chatTopNotice.putTopNotice({
    path: { chat_id: config.portalChatId },
    data: { chat_top_notice: [{ action_type: '1', message_id: messageId }] },
  });
  if (pinned.code !== undefined && pinned.code !== 0) {
    throw new Error(`置顶失败(卡已发出,message_id=${messageId}):code=${pinned.code} msg=${pinned.msg ?? ''}`);
  }
  console.log(`大厅卡已发送并置顶 message_id=${messageId}`);
}

main().catch((e) => {
  console.error(errMsg(e));
  process.exit(1);
});
