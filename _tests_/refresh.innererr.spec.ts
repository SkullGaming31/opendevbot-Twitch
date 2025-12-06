import { describe, it, expect, vi } from 'vitest';

process.env.TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID ?? 'cid';
process.env.TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET ?? 'csec';

vi.resetModules();

const token = { _id: 'ie1', refresh_token: 'r1' } as any;

// auth will throw
const postMock = vi.fn(() => { throw new Error('upstream'); });

vi.doMock('../src/auth/API', () => ({ authURL: { post: postMock } }));

// find returns token
const findMock = vi.fn(() => ({ limit: () => ({ exec: () => Promise.resolve([token]) }) }));

// findByIdAndUpdate: when called to increment, throw to trigger innerErr
const findByIdAndUpdateMock = vi.fn((id: string, update: any) => {
  if (update && update.$inc) {
    throw new Error('db write failed');
  }
  return { exec: async () => ({ _id: id }) };
});

vi.doMock('../src/Database/models/token', () => ({ TokenModel: { find: findMock, findByIdAndUpdate: findByIdAndUpdateMock } }));
vi.doMock('../src/Database', () => ({ dbReady: Promise.resolve(null) }));

describe('refresh inner error', () => {
  it('logs inner error when retry increment fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { refreshOnce } = await import('../src/auth/refresh');
    await refreshOnce({ lookAheadMs: 1000, batchSize: 1, maxRetries: 2 });
    expect(postMock).toHaveBeenCalled();
    expect(findMock).toHaveBeenCalled();
    expect(findByIdAndUpdateMock).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
