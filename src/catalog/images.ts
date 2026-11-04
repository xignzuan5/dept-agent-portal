import type * as lark from '@larksuiteoapi/node-sdk';

async function toBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  const chunks: Buffer[] = [];
  for await (const c of body as AsyncIterable<Buffer | Uint8Array>) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

/**
 * Resolves a Base attachment file_token to an IM image_key: downloads the
 * attachment via the drive media API, then uploads it as a message image.
 */
export function createImageResolver(client: lark.Client): (fileToken: string) => Promise<string> {
  return async (fileToken) => {
    const dl = (await client.drive.v1.media.download({ path: { file_token: fileToken } })) as {
      getReadableStream: () => AsyncIterable<Buffer>;
    };
    const buf = await toBuffer(dl.getReadableStream());
    if (buf.length === 0) throw new Error(`附件 ${fileToken} 下载为空`);
    const up = (await client.im.v1.image.create({ data: { image_type: 'message', image: buf } })) as {
      code?: number;
      msg?: string;
      image_key?: string;
      data?: { image_key?: string };
    } | null;
    if (up?.code) throw new Error(`图片上传失败: code=${up.code} ${up.msg ?? ''}`);
    const key = up?.image_key ?? up?.data?.image_key;
    if (!key) throw new Error('图片上传失败: 未返回 image_key');
    return key;
  };
}
