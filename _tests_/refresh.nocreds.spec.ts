import { describe, it, expect, vi } from 'vitest';

// Ensure no Twitch creds in env
delete process.env.TWITCH_CLIENT_ID;
delete process.env.TWITCH_CLIENT_SECRET;

vi.resetModules();

const token = { _id: 'nc1', refresh_token: 'r1' } as any;

// Mock auth API (should not be called)
const postMock = vi.fn(() => ({ data: {} }));
vi.doMock('../src/auth/API', () => ({ authURL: { post: postMock } }));

// Mock TokenModel.find to return our token
const findMock = vi.fn(() => ({ limit: () => ({ exec: () => Promise.resolve([token]) }) }));

// Mock findByIdAndUpdate to capture $inc call
const findByIdAndUpdateMock = vi.fn(() => ({ exec: () => Promise.resolve({ retry_count: 1 }) }));
vi.doMock('../src/Database/models/token', () => ({ TokenModel: { find: findMock, findByIdAndUpdate: findByIdAndUpdateMock } }));
vi.doMock('../src/Database', () => ({ dbReady: Promise.resolve(null) }));

describe('refresh with missing creds', () => {
  it('does not call auth and increments retry_count', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { refreshOnce } = await import('../src/auth/refresh');
    await refreshOnce({ lookAheadMs: 1000, batchSize: 1, maxRetries: 2 });

    expect(postMock).not.toHaveBeenCalled();
    expect(findMock).toHaveBeenCalled();
    expect(findByIdAndUpdateMock).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
