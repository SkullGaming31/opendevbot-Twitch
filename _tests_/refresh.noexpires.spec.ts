import { describe, it, expect, vi } from 'vitest';

process.env.TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID ?? 'cid';
process.env.TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET ?? 'csec';

vi.resetModules();

const token = { _id: 'nx1', refresh_token: 'r1' } as any;

// auth returns data without expires_in
const postMock = vi.fn(() => ({ data: { access_token: 'a-token' } }));

vi.doMock('../src/auth/API', () => ({ authURL: { post: postMock } }));

const findMock = vi.fn(() => ({ limit: () => ({ exec: () => Promise.resolve([token]) }) }));
const findByIdAndUpdateMock = vi.fn(() => ({ exec: () => Promise.resolve({ _id: 'nx1', access_token: 'a-token' }) }));

vi.doMock('../src/Database/models/token', () => ({ TokenModel: { find: findMock, findByIdAndUpdate: findByIdAndUpdateMock } }));
vi.doMock('../src/Database', () => ({ dbReady: Promise.resolve(null) }));

describe('refresh no expires_in', () => {
  it('updates token even when expires_in is missing', async () => {
    const { refreshOnce } = await import('../src/auth/refresh');
    await refreshOnce({ lookAheadMs: 1000, batchSize: 1 });

    expect(postMock).toHaveBeenCalled();
    expect(findMock).toHaveBeenCalled();
    expect(findByIdAndUpdateMock).toHaveBeenCalled();
  });
});
