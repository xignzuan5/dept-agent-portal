import { describe, expect, it } from 'vitest';
import { createSeenSet, isPortalCommand, mentionsBot } from '../../src/bot/intent.js';

describe('isPortalCommand', () => {
  it('accepts 门户 / Portal / "@_user_1 门户"', () => {
    expect(isPortalCommand('门户')).toBe(true);
    expect(isPortalCommand('Portal')).toBe(true);
    expect(isPortalCommand('@_user_1 门户')).toBe(true);
    expect(isPortalCommand('  门户 ')).toBe(true);
  });
  it('rejects 门户呢', () => {
    expect(isPortalCommand('门户呢')).toBe(false);
    expect(isPortalCommand('')).toBe(false);
  });
});

describe('mentionsBot', () => {
  it('matches only the bot open_id', () => {
    expect(mentionsBot([{ id: { open_id: 'ou_b' } }], 'ou_b')).toBe(true);
    expect(mentionsBot([{ id: { open_id: 'ou_x' } }], 'ou_b')).toBe(false);
    expect(mentionsBot(undefined, 'ou_b')).toBe(false);
    expect(mentionsBot([{ id: { open_id: '' } }], '')).toBe(false);
  });
});

describe('createSeenSet', () => {
  it('reports first sight once', () => {
    const first = createSeenSet();
    expect(first('a')).toBe(true);
    expect(first('a')).toBe(false);
    expect(first('b')).toBe(true);
  });
  it('drops the oldest beyond cap', () => {
    const first = createSeenSet(2);
    first('a'); first('b'); first('c');
    expect(first('a')).toBe(true);
    expect(first('c')).toBe(false);
  });
});
