import { describe, it, expect, vi } from 'vitest';

vi.resetModules();

// dbReady resolves
vi.doMock('../src/Database', () => ({ dbReady: Promise.resolve(null) }));

// TokenModel.find: first call returns empty (initial run succeeds), second call throws (scheduled run fails)
let calls = 0;
const findMock = vi.fn(() => {
  calls += 1;
  if (calls === 1) return { limit: () => ({ exec: () => Promise.resolve([]) }) };
  return { limit: () => ({ exec: () => { throw new Error('scheduled fail'); } }) };
});
vi.doMock('../src/Database/models/token', () => ({ TokenModel: { find: findMock } }));
vi.doMock('../src/auth/API', () => ({ authURL: { post: vi.fn() } }));

describe('scheduled run failure', () => {
  it('logs scheduled run failure after initial success', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { startRefreshWorker, stopRefreshWorker } = await import('../src/auth/refresh');

    startRefreshWorker({ intervalMs: 20 });
    await new Promise((r) => setTimeout(r, 80));

    const found = errSpy.mock.calls.some((c) => String(c[0]).includes('[refresh] scheduled run failed'));
    expect(found).toBe(true);

    stopRefreshWorker();
    errSpy.mockRestore();
  });
});
