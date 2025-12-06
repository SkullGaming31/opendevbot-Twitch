import { describe, it, expect, vi } from 'vitest';
import { authURL } from '../src/auth/API';

describe('Auth axios instance mocks', () => {
  it('mocks authURL.post for token exchange and returns mocked token', async () => {
    const mockResponse = { data: { access_token: 'mocked_token_123' } };

    // Spy on the axios instance method and make it return our mock
    const spy = vi.spyOn(authURL, 'post').mockResolvedValue(mockResponse as any);

    // Call the method as the code under test would
    const res = await authURL.post('/token', { grant_type: 'client_credentials' });

    expect(spy).toHaveBeenCalledWith('/token', { grant_type: 'client_credentials' });
    expect(res.data.access_token).toBe('mocked_token_123');

    spy.mockRestore();
  });

  it('allows verifying multiple calls and different args', async () => {
    const spy = vi.spyOn(authURL, 'post').mockResolvedValue({ data: { ok: true } } as any);

    await authURL.post('/token', { a: 1 });
    await authURL.post('/token', { a: 2 });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, '/token', { a: 1 });
    expect(spy).toHaveBeenNthCalledWith(2, '/token', { a: 2 });

    spy.mockRestore();
  });
});
