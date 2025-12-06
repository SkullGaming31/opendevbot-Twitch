import { describe, it, expect, vi } from 'vitest';

process.env.TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID ?? 'cid';
process.env.TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET ?? 'csec';

vi.resetModules();

const token = { _id: 'r1', refresh_token: 'r1' } as any;

const postMock = vi.fn(() => ({ data: { access_token: 'new', refresh_token: 'nr', expires_in: 3600 } }));

// find returns our token
const findMock = vi.fn(() => ({ limit: () => ({ exec: () => Promise.resolve([token]) }) }));

// findByIdAndUpdate should be called twice: once to set new tokens, once to reset retry_count
const findByIdAndUpdateMock = vi.fn((id: string, update: any) => {
  const ret = { _id: id, ...((update && update.$set) || {}) };
  return { exec: async () => ret };
});

vi.doMock('../src/auth/API', () => ({ authURL: { post: postMock } }));
vi.doMock('../src/Database/models/token', () => ({ TokenModel: { find: findMock, findByIdAndUpdate: findByIdAndUpdateMock } }));
vi.doMock('../src/Database', () => ({ dbReady: Promise.resolve(null) }));

describe('refresh reset retry_count', () => {
  it('calls findByIdAndUpdate to reset retry_count after success', async () => {
    const { refreshOnce } = await import('../src/auth/refresh');
    await refreshOnce({ lookAheadMs: 1000, batchSize: 1 });

    // Expect two calls: one for updating token, one for resetting retry_count
    expect(findByIdAndUpdateMock).toHaveBeenCalled();
    expect(findByIdAndUpdateMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    const secondCall = findByIdAndUpdateMock.mock.calls[1];
    expect(secondCall[1]).toHaveProperty('$set');
    expect((secondCall[1].$set as any).retry_count).toBe(0);
  });
});
