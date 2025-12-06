import { describe, it, expect, vi } from 'vitest';

vi.resetModules();

// Mock DB ready and TokenModel.find to return empty array
vi.doMock('../src/Database', () => ({ dbReady: Promise.resolve(null) }));
vi.doMock('../src/Database/models/token', () => ({ TokenModel: { find: () => ({ limit: () => ({ exec: () => Promise.resolve([]) }) }) } }));
vi.doMock('../src/auth/API', () => ({ authURL: { post: vi.fn() } }));

describe('refresh early return when no tokens', () => {
  it('returns without attempting refresh', async () => {
    const { refreshOnce } = await import('../src/auth/refresh');
    // should simply return without throwing
    await refreshOnce({ lookAheadMs: 1000, batchSize: 1 });
  });
});
