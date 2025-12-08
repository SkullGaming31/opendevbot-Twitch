import { describe, it, expect, vi } from 'vitest';

vi.resetModules();

// Make dbReady resolve
vi.doMock('../src/Database', () => ({ dbReady: Promise.resolve(null) }));

// Make TokenModel.find throw to force processBatch to reject
const findMock = vi.fn(() => ({ limit: () => ({ exec: () => { throw new Error('find failure'); } }) }));
vi.doMock('../src/Database/models/token', () => ({ TokenModel: { find: findMock } }));

describe('startRefreshWorker initial/scheduled failure paths', () => {
  it('logs initial run failure when processBatch rejects', async () => {
    const logger = (await import('../src/logger')).default;
    const errSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const { startRefreshWorker, stopRefreshWorker } = await import('../src/auth/refresh');

    startRefreshWorker({ intervalMs: 10 });
    // allow initial run attempt
    await new Promise((r) => setTimeout(r, 30));

    expect(errSpy).toHaveBeenCalled();
    const found = errSpy.mock.calls.some((c) => Array.from(c).some((a) => String(a).includes('[refresh] initial run failed')));
    expect(found).toBe(true);

    // cleanup
    stopRefreshWorker();
    errSpy.mockRestore();
  });
});
