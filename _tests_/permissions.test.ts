import { describe, it, expect } from 'vitest';
import { isAllowedByPermission } from '../src/Commands/core/permission';

describe('permission helper', () => {
  it('allows owner when user-id matches OWNER', () => {
    const tags = { 'user-id': '123' };
    expect(isAllowedByPermission(tags, 'owner', '123')).toBe(true);
    expect(isAllowedByPermission(tags, 'owner', '999')).toBe(false);
  });

  it('detects broadcaster from badges', () => {
    const tags = { badges: 'broadcaster/1,subscriber/12', 'user-id': '10', 'room-id': '10' };
    expect(isAllowedByPermission(tags, 'broadcaster')).toBe(true);
    expect(isAllowedByPermission({}, 'broadcaster')).toBe(false);
  });

  it('detects moderator from badges or mod flag', () => {
    expect(isAllowedByPermission({ badges: 'moderator/1' }, 'mod')).toBe(true);
    expect(isAllowedByPermission({ mod: '1' }, 'mod')).toBe(true);
    expect(isAllowedByPermission({}, 'mod')).toBe(false);
  });

  it('detects vip and subscriber', () => {
    expect(isAllowedByPermission({ badges: 'vip/1' }, 'vip')).toBe(true);
    expect(isAllowedByPermission({ badges: 'subscriber/1' }, 'subscriber')).toBe(true);
    expect(isAllowedByPermission({ subscriber: '1' }, 'subscriber')).toBe(true);
  });

  it('supports arrays of permissions', () => {
    const tags = { badges: 'moderator/1' };
    expect(isAllowedByPermission(tags, ['vip', 'mod'])).toBe(true);
    expect(isAllowedByPermission({}, ['vip', 'mod'])).toBe(false);
  });

  it('everyone always allowed', () => {
    expect(isAllowedByPermission({}, 'everyone')).toBe(true);
  });
});
