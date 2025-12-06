import { describe, it, expect, vi } from 'vitest';

vi.resetModules();

// Spy on the query passed to TokenModel.find
let capturedQuery: any = null;
const findMock = vi.fn((q: any) => {
  capturedQuery = q;
  return { limit: () => ({ exec: () => Promise.resolve([]) }) };
});

vi.doMock('../src/Database/models/token', () => ({ TokenModel: { find: findMock } }));
vi.doMock('../src/Database', () => ({ dbReady: Promise.resolve(null) }));
vi.doMock('../src/auth/API', () => ({ authURL: { post: vi.fn() } }));

describe('refresh query construction', () => {
  it('includes refresh_token existence and disabled filter', async () => {
    const { refreshOnce } = await import('../src/auth/refresh');
    await refreshOnce({ lookAheadMs: 1000, batchSize: 1 });

    expect(findMock).toHaveBeenCalled();
    expect(capturedQuery).toBeTruthy();
    expect(capturedQuery.refresh_token).toBeDefined();
    expect(capturedQuery.disabled).toBeDefined();
    expect(capturedQuery.disabled.$ne).toBe(true);
    expect(Array.isArray(capturedQuery.$or)).toBe(true);
  });
});
