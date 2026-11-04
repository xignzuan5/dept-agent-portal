export const MAX_ELEMENTS = 200;
export const MAX_BYTES = 28 * 1024;

/** 递归统计所有含 tag 键的对象(卡片元素上限按此口径)。 */
export function countElements(card: object): number {
  let n = 0;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === 'object') {
      if ('tag' in v) n++;
      Object.values(v).forEach(walk);
    }
  };
  walk(card);
  return n;
}

export function cardBytes(card: object): number {
  return Buffer.byteLength(JSON.stringify(card));
}
