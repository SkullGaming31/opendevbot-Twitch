import { describe, it, expect, vi, beforeEach } from 'vitest';

// Preamble: set up environment and mocks before importing the module under test
process.env.TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID ?? 'test-client';
process.env.TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET ?? 'test-secret';

const postMock = vi.fn(() => ({ data: { access_token: 'a', refresh_token: 'r', expires_in: 3600 } }));
vi.mock('../src/auth/API', () => ({ authURL: { post: postMock } }));

const findOneMock = vi.fn(() => ({ exec: () => Promise.resolve({ _id: 'u1', user_id: 'u1' }) }));
const findOneAndUpdateMock = vi.fn(() => ({ exec: () => Promise.resolve({ _id: 'u1', user_id: 'u1' }) }));
const createMock = vi.fn((doc: any) => Promise.resolve({ _id: 'created', ...doc }));
const findByIdAndUpdateMock = vi.fn(() => ({ exec: () => Promise.resolve({ _id: 'doc1', user_id: 'u1' }) }));
const deleteOneMock = vi.fn(() => ({ exec: () => Promise.resolve({ deletedCount: 1 }) }));

vi.mock('../src/Database', () => ({
  TokenModel: {
    findOne: findOneMock,
    findOneAndUpdate: findOneAndUpdateMock,
    create: createMock,
    findByIdAndUpdate: findByIdAndUpdateMock,
    deleteOne: deleteOneMock,
  },
  dbReady: Promise.resolve(null),
}));

describe('auth/twitch helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('exchangeCodeForToken posts correct form data', async () => {
    const { exchangeCodeForToken } = await import('../src/auth/twitch');
    const res = await exchangeCodeForToken('thecode', 'https://cb', 'cid', 'csecret');
    expect(postMock).toHaveBeenCalled();
    const calledWith = postMock.mock.calls[0][1] as string;
    expect(calledWith).toContain('code=thecode');
    expect(res).toBeDefined();
  });

  it('getTokenByUserId calls findOne', async () => {
    const { getTokenByUserId } = await import('../src/auth/twitch');
    const doc = await getTokenByUserId('u1');
    expect(findOneMock).toHaveBeenCalledWith({ user_id: 'u1' });
    expect(doc).toBeTruthy();
  });

  it('saveOrUpdateToken creates when no user_id', async () => {
    const { saveOrUpdateToken } = await import('../src/auth/twitch');
    const created = await saveOrUpdateToken({ access_token: 'a', refresh_token: 'r', scopes: ['s'] });
    expect(createMock).toHaveBeenCalled();
    expect((created as any)._id).toBe('created');
  });

  it('saveOrUpdateToken upserts when user_id present', async () => {
    const { saveOrUpdateToken } = await import('../src/auth/twitch');
    const updated = await saveOrUpdateToken({ access_token: 'a', refresh_token: 'r', scopes: [], user_id: 'u1' } as any);
    expect(findOneAndUpdateMock).toHaveBeenCalled();
    expect((updated as any).user_id).toBe('u1');
  });

  it('attachUserIdToToken updates document', async () => {
    const { attachUserIdToToken } = await import('../src/auth/twitch');
    const res = await attachUserIdToToken('doc1', 'u1');
    expect(findByIdAndUpdateMock).toHaveBeenCalledWith('doc1', { $set: { user_id: 'u1' } }, { new: true });
    expect((res as any).user_id).toBe('u1');
  });

  it('deleteTokenByUserId deletes document', async () => {
    const { deleteTokenByUserId } = await import('../src/auth/twitch');
    const r = await deleteTokenByUserId('u1');
    expect(deleteOneMock).toHaveBeenCalledWith({ user_id: 'u1' });
    expect((await r).deletedCount || (r as any).deletedCount).toBeDefined();
  });
});
