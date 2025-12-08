
      import { describe, it, expect, vi } from 'vitest';
      import logger from '../src/logger';

      vi.resetModules();

        let rejectDbReady: (err?: any) => void;
        const dbReady = new Promise((_res, rej) => { rejectDbReady = rej!; });
        vi.doMock('../src/Database', () => ({ dbReady }));

        describe('refresh start when dbReady rejects', () => {
          it('logs db-not-ready error', async () => {
            const logger = (await import('../src/logger')).default;
            const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

              const { startRefreshWorker, stopRefreshWorker } = await import('../src/auth/refresh');
            startRefreshWorker();

            // Trigger the rejection while the worker is active and allow a tick
            // for handlers to process it.
            rejectDbReady(new Error('boom from db'));
            await new Promise((r) => setTimeout(r, 0));

            expect(errorSpy).toHaveBeenCalled();
            const found = errorSpy.mock.calls.some((c) => Array.from(c).some((a) => String(a).includes('[refresh] db not ready')));
            expect(found).toBe(true);

            try {
              stopRefreshWorker();
            } catch {}
            errorSpy.mockRestore();
          });
        });
