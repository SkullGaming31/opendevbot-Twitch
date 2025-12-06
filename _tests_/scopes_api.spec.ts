import { describe, it, expect } from 'vitest';

import { authURL, helix } from '../src/auth/API';
import { buildAuthorizeUrl } from '../src/auth/scopes';

describe('API instances', () => {
  it('exports authURL and helix with correct base URLs', () => {
    expect(authURL).toBeDefined();
    expect(helix).toBeDefined();
    const a = (authURL as any).defaults?.baseURL ?? (authURL as any).baseURL ?? '';
    const h = (helix as any).defaults?.baseURL ?? (helix as any).baseURL ?? '';
    expect(String(a)).toContain('id.twitch.tv');
    expect(String(h)).toContain('api.twitch.tv');
  });
});

describe('scopes builder', () => {
  it('buildAuthorizeUrl includes client_id, redirect_uri and scopes', () => {
    const url = buildAuthorizeUrl({ clientId: 'cli', redirectUri: 'https://app/cb', scopes: ['a', 'b'], forceVerify: false });
    expect(url).toContain('client_id=cli');
    expect(url).toContain(encodeURIComponent('https://app/cb'));
    expect(url).toContain('scope=a+b');
  });
});
