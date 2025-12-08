// Global test setup for Vitest
import logger from './logger';

// Attach a handler for unhandled rejections so tests that intentionally
// create rejected Promises (e.g., mocks) don't cause Vitest to fail the run.
process.on('unhandledRejection', (reason) => {
  try {
    logger?.warn ? logger.warn({ err: String(reason) }, '[test-setup] unhandledRejection') : undefined;
  } catch {}
});

// Ensure NODE_ENV=test for conditional code paths
process.env.ENVIRONMENT = process.env.ENVIRONMENT ?? 'test';
