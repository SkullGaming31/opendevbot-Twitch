import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Ensure Twitch client credentials are present for the refresh logic
process.env.TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID ?? 'test-client-id';
process.env.TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET ?? 'test-client-secret';

// Mock DB readiness before importing the module under test
vi.mock('../src/Database', () => ({ dbReady: Promise.resolve(null) }));

const postMock = vi.fn(() => ({ data: { access_token: 'new_access', refresh_token: 'new_refresh', expires_in: 3600 } }));
vi.mock('../src/auth/API', () => ({ authURL: { post: postMock } }));

const findMock = vi.fn(() => ({ limit: () => ({ exec: () => Promise.resolve([{ _id: 'mock1', refresh_token: 'r1' }]) }) }));
const findByIdAndUpdateMock = vi.fn(() => ({ exec: () => Promise.resolve({ _id: 'mock1', expires_at: new Date() }) }));
vi.mock('../src/Database/models/token', () => ({
  TokenModel: {
    find: findMock,
    findByIdAndUpdate: findByIdAndUpdateMock,
  },
}));

let refresher: any;

describe('refresh worker', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    // import after mocks applied
    refresher = await import('../src/auth/refresh');
  });

  afterEach(() => {
    try {
      refresher.stopRefreshWorker();
    } catch {}
  });

  it('refreshes tokens by calling Twitch and updating DB', async () => {
    // Start worker with fast interval and small batch
    refresher.startRefreshWorker({ intervalMs: 100, lookAheadMs: 1000, batchSize: 1 });

    // Wait a short time for the initial run to complete
    await new Promise((r) => setTimeout(r, 250));

    // Expect the authURL.post to have been called to refresh
    expect(postMock).toHaveBeenCalled();

    // Expect the DB find and update were called
    expect(findMock).toHaveBeenCalled();
    expect(findByIdAndUpdateMock).toHaveBeenCalled();
  });
});
