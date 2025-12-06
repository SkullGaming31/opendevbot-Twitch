import { describe, it, expect, vi } from 'vitest';

// Setup env
process.env.TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID ?? 'cid';
process.env.TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET ?? 'csec';

// We'll mock the TokenModel used by the refresher and the auth API
vi.mock('../src/Database', () => ({ dbReady: Promise.resolve(null) }));

describe('refresh retry/backoff behavior', () => {
  it('increments retry_count and disables token after maxRetries', async () => {
    // token state
    const token = { _id: 't1', refresh_token: 'r1', retry_count: 0, disabled: false } as any;

    // mock find to return the token each run
    const findMock = vi.fn(() => ({ limit: () => ({ exec: () => Promise.resolve([token]) }) }));

    // create stateful findByIdAndUpdate mock to handle $inc and $set
    let stored = { ...token };
    const findByIdAndUpdateMock = vi.fn((id: string, update: any, opts: any) => {
      if (update && update.$inc && typeof update.$inc.retry_count === 'number') {
        stored.retry_count = (stored.retry_count || 0) + update.$inc.retry_count;
        const ret = { ...stored };
        return { exec: async () => ret };
      }
      if (update && update.$set) {
        stored = { ...stored, ...(update.$set as any) };
        const ret = { ...stored };
        return { exec: async () => ret };
      }
      const ret = { ...stored };
      return { exec: async () => ret };
    });

    // authURL.post which will fail twice then succeed
    let callCount = 0;
    const postMock = vi.fn(() => {
      callCount += 1;
      if (callCount <= 2) throw new Error('network');
      return { data: { access_token: 'new', refresh_token: 'nr', expires_in: 3600 } };
    });

    // Mock modules before importing refresher
    vi.resetModules();
    vi.doMock('../src/auth/API', () => ({ authURL: { post: postMock } }));
    vi.doMock('../src/Database/models/token', () => ({ TokenModel: { find: findMock, findByIdAndUpdate: findByIdAndUpdateMock } }));

    const { refreshOnce } = await import('../src/auth/refresh');

    // Run the refresh logic twice to simulate two consecutive attempts (both fail)
    await refreshOnce({ lookAheadMs: 1000, batchSize: 1, maxRetries: 2 });
    await refreshOnce({ lookAheadMs: 1000, batchSize: 1, maxRetries: 2 });

    // After two failures, retry_count should be 2 and token should be disabled
    expect(findByIdAndUpdateMock).toHaveBeenCalled();
    expect(stored.retry_count).toBeGreaterThanOrEqual(2);
    expect(stored.disabled).toBe(true);
  });
});
