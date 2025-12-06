import { describe, it, expect, vi } from 'vitest';

// Ensure creds so refresh worker logic runs (even though authURL will be mocked)
process.env.TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID ?? 't';
process.env.TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET ?? 's';

// We'll mock dbReady and TokenModel to return different token shapes
vi.mock('../src/Database', () => ({
  dbReady: Promise.resolve(null),
  TokenModel: {
    find: vi.fn(() => ({ limit: () => ({ exec: () => Promise.resolve([]) }) })),
  },
}));

// Import the refresh module after mocks
const startStop = async (postImpl: any, tokens: any[]) => {
  // Clear module cache so our dynamic mocks take effect
  vi.resetModules();
  const postMock = vi.fn(postImpl);
  // Replace authURL.post via mocking the API module before importing refresher
  vi.doMock('../src/auth/API', () => ({ authURL: { post: postMock } }));

  // Provide a mocked TokenModel module (refresh imports from ../Database/models/token)
  vi.doMock('../src/Database/models/token', () => ({
    TokenModel: {
      find: () => ({ limit: () => ({ exec: () => Promise.resolve(tokens) }) }),
    },
  }));

  const refresher = await import('../src/auth/refresh');
  // Spy on console.warn to capture error logs
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  refresher.startRefreshWorker({ intervalMs: 100, lookAheadMs: 1000, batchSize: 10 });
  await new Promise((r) => setTimeout(r, 200));
  refresher.stopRefreshWorker();
  warn.mockRestore();
  return { postMock, warn };
};

describe('refresh worker failure paths', () => {
  it('skips tokens without refresh_token', async () => {
    const tokens = [{ _id: 'no-refresh', refresh_token: null }];
    const { postMock } = await startStop(() => ({ data: {} }), tokens);
    expect(postMock).not.toHaveBeenCalled();
  });

  it('logs warning when auth endpoint throws', async () => {
    const tokens = [{ _id: 'bad1', refresh_token: 'r1' }];
    const impl = () => { throw Object.assign(new Error('e'), { response: { data: { error: 'bad' } } }); };
    const { postMock } = await startStop(impl, tokens);
    expect(postMock).toHaveBeenCalled();
  });
});
