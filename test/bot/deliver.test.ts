import { describe, expect, it, vi } from 'vitest';
import { createDeliverer } from '../../src/bot/deliver.js';

const stub = (code = 0) => {
  const create = vi.fn(async () => ({ code, msg: 'm' }));
  const request = vi.fn(async () => ({ code, msg: 'm' }));
  return { create, request, client: { im: { v1: { message: { create } } }, request } as any };
};
const card = { schema: '2.0' };

describe('createDeliverer', () => {
  it('p2p mode sends via message.create to open_id', async () => {
    const s = stub();
    const r = await createDeliverer(s.client, 'p2p').personalPortal({ chatId: 'oc', openId: 'ou', chatType: 'group' }, card);
    expect(r.via).toBe('p2p');
    expect(s.create).toHaveBeenCalledWith(expect.objectContaining({ params: { receive_id_type: 'open_id' } }));
    expect(s.request).not.toHaveBeenCalled();
  });
  it('ephemeral mode in a group posts to the ephemeral endpoint', async () => {
    const s = stub();
    const r = await createDeliverer(s.client, 'ephemeral').personalPortal({ chatId: 'oc', openId: 'ou', chatType: 'group' }, card);
    expect(r.via).toBe('ephemeral');
    expect(s.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', url: '/open-apis/ephemeral/v1/send' }));
  });
  it('rejects on non-zero code', async () => {
    const s = stub(99);
    await expect(createDeliverer(s.client, 'p2p').personalPortal({ chatId: '', openId: 'ou', chatType: 'p2p' }, card)).rejects.toThrow(/99/);
  });
});
