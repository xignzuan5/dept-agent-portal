import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import type * as lark from '@larksuiteoapi/node-sdk';
import { createImageResolver } from '../../src/catalog/images.js';

const fake = (upload: unknown) => {
  const download = vi.fn(async () => ({ getReadableStream: () => Readable.from([Buffer.from('png-bytes')]) }));
  const create = vi.fn(async () => upload);
  const client = { drive: { v1: { media: { download } } }, im: { v1: { image: { create } } } } as unknown as lark.Client;
  return { client, download, create };
};

describe('createImageResolver', () => {
  it('downloads the attachment, uploads it and returns the image_key', async () => {
    const { client, download, create } = fake({ image_key: 'img_abc' });
    expect(await createImageResolver(client)('TOK')).toBe('img_abc');
    expect(download).toHaveBeenCalledWith({ path: { file_token: 'TOK' } });
    const arg = create.mock.calls[0] as unknown as [{ data: { image_type: string; image: Buffer } }];
    expect(arg[0].data.image_type).toBe('message');
    expect(arg[0].data.image.toString()).toBe('png-bytes');
  });
  it('throws when upload returns no key', async () => {
    const { client } = fake({});
    await expect(createImageResolver(client)('TOK')).rejects.toThrow('image_key');
  });
});
