import { describe, it, expect } from 'vitest';
import { scopesToString, buildAuthorizeUrl, CHANNEL_SCOPES, MODERATION_SCOPES } from '../src/auth/scopes';

describe('scopes helpers extra', () => {
  it('scopesToString encodes spaces and special chars', () => {
    const s = scopesToString(['a', 'b+c', 'd e']);
    expect(s).toContain('%20');
    expect(decodeURIComponent(s)).toBe('a b+c d e');
  });

  it('buildAuthorizeUrl supports state and forceVerify', () => {
    const url = buildAuthorizeUrl({ clientId: 'cid', redirectUri: 'https://cb', scopes: ['x'], state: 's123', forceVerify: true });
    expect(url).toContain('state=s123');
    expect(url).toContain('force_verify=true');
  });

  it('default scopes include channel and moderation groups', () => {
    const url = buildAuthorizeUrl({ clientId: 'cid', redirectUri: 'https://cb' });
    // The default scope param must include at least one scope from each group
    expect(url).toContain(encodeURIComponent(CHANNEL_SCOPES[0]));
    expect(url).toContain(encodeURIComponent(MODERATION_SCOPES[0]));
  });
});
