/** 去掉 @ 提及占位(@_user_N)后 trim,等于「门户」或忽略大小写等于 portal。 */
export function isPortalCommand(text: string): boolean {
  const t = text.replace(/@_user_\d+/g, '').trim();
  return t === '门户' || t.toLowerCase() === 'portal';
}

/** 群消息里是否 @ 了机器人自己。 */
export function mentionsBot(
  mentions: Array<{ id?: { open_id?: string } }> | undefined,
  botOpenId: string,
): boolean {
  return !!botOpenId && (mentions ?? []).some((m) => m.id?.open_id === botOpenId);
}

/** 内存去重集合:超过上限丢最早的。返回 true 表示首次见到。 */
export function createSeenSet(cap = 1000): (key: string) => boolean {
  const seen = new Set<string>();
  return (key) => {
    if (seen.has(key)) return false;
    seen.add(key);
    if (seen.size > cap) seen.delete(seen.values().next().value as string);
    return true;
  };
}
