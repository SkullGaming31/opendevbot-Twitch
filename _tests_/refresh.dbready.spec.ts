import { describe, it, expect, vi } from 'vitest';

// Simulate dbReady rejecting to ensure startRefreshWorker logs the db-not-ready message
vi.resetModules();
vi.doMock('../src/Database', () => ({ dbReady: Promise.reject(new Error('boom from db')) }));

describe('refresh start when dbReady rejects', () => {
  it('logs db-not-ready error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { startRefreshWorker, stopRefreshWorker } = await import('../src/auth/refresh');
    startRefreshWorker();

    // Allow promise microtasks to run
    await new Promise((r) => setTimeout(r, 10));

    expect(errorSpy).toHaveBeenCalled();
    // The first argument should include our identifying message
    const firstCallArg = errorSpy.mock.calls[0][0] as string;
    expect(String(firstCallArg)).toContain('[refresh] db not ready');

    // cleanup: ensure the worker state is reset
    try {
      stopRefreshWorker();
    } catch {}
    errorSpy.mockRestore();
  });
});
