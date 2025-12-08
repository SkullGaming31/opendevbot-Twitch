import { describe, it, expect } from 'vitest';
import { isAllowedByPermission } from '../src/Commands/core/permission';

describe('broadcaster detection', () => {
  it('detects broadcaster when user-id equals room-id', () => {
    const tags = { 'user-id': '100', 'room-id': '100' };
    expect(isAllowedByPermission(tags, 'broadcaster')).toBe(true);
  });

  it('detects broadcaster from badges', () => {
    expect(isAllowedByPermission({ badges: 'broadcaster/1' }, 'broadcaster')).toBe(true);
  });
});
