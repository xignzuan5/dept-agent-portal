import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const full = {
  FEISHU_APP_ID: 'cli_x', FEISHU_APP_SECRET: 'sekret-value', CATALOG_APP_TOKEN: 'app', CATALOG_TABLE_ID: 'tbl',
  PROMO_TABLE_ID: 'tbl2', PORTAL_CHAT_ID: 'oc_1', DEPT_NAME: '销售前端', DEPT_INTRO: '简介', PERSONAL_DELIVERY: 'p2p',
};

describe('loadConfig', () => {
  it('lists every missing key', () => {
    expect(() => loadConfig({})).toThrow(/FEISHU_APP_ID.*FEISHU_APP_SECRET.*CATALOG_APP_TOKEN.*CATALOG_TABLE_ID.*PROMO_TABLE_ID.*PORTAL_CHAT_ID.*DEPT_NAME.*DEPT_INTRO.*PERSONAL_DELIVERY/);
  });
  it('maps ROUTER_LINK empty to null', () => {
    expect(loadConfig({ ...full, ROUTER_LINK: '' }).dept.routerLink).toBeNull();
    expect(loadConfig({ ...full, ROUTER_LINK: 'https://a.b' }).dept.routerLink).toBe('https://a.b');
  });
  it('rejects bad PERSONAL_DELIVERY without leaking secret', () => {
    try {
      loadConfig({ ...full, PERSONAL_DELIVERY: 'x' });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).toContain('PERSONAL_DELIVERY');
      expect(String(e)).not.toContain('sekret-value');
    }
  });
  it('accepts ephemeral', () => {
    expect(loadConfig({ ...full, PERSONAL_DELIVERY: 'ephemeral' }).personalDelivery).toBe('ephemeral');
  });
  it('maps fields', () => {
    const c = loadConfig(full);
    expect(c.personalDelivery).toBe('p2p');
    expect(c.promoTableId).toBe('tbl2');
    expect(c.dept.name).toBe('销售前端');
  });
});
