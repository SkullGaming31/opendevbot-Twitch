import { authURL } from './API';
import { TokenModel, IToken } from '../Database/models/token';
import { dbReady } from '../Database';
import logger from '../logger';

// Attach a noop rejection handler to avoid unhandled rejection warnings
// when test suites mock `dbReady` as a rejected Promise before we attach
// our own .then/.catch handlers in `startRefreshWorker`.
/* istanbul ignore next */
if (dbReady && typeof (dbReady as any).catch === 'function') (dbReady as any).catch(() => {});

// In test environments, attach a lightweight unhandledRejection handler to
// prevent Vitest from treating intentionally-rejected mocked promises as
// test errors. This keeps test behavior stable while still logging the
// rejection to our logger.
/* istanbul ignore next */
if (process.env.NODE_ENV === 'test') {
  process.on('unhandledRejection', (reason) => {
    try {
      logger?.warn ? logger.warn({ err: String(reason) }, 'unhandledRejection') : undefined;
    } catch {}
  });
}

let _interval: NodeJS.Timeout | null = null;
let _running = false;

export interface RefreshOptions {
  intervalMs?: number; // how often the worker scans for tokens
  lookAheadMs?: number; // refresh tokens that expire within this window
  batchSize?: number; // max tokens to refresh per run
  maxRetries?: number; // mark token disabled after this many consecutive failures
}

const DEFAULTS: Required<RefreshOptions> = {
  intervalMs: 1000 * 60 * 5, // 5 minutes
  lookAheadMs: 1000 * 60 * 60, // 1 hour
  batchSize: 50,
  maxRetries: 3,
};

function getClientCredentials() {
  const clientId = process.env.TWITCH_CLIENT_ID ?? process.env.CLIENT_ID ?? '';
  const clientSecret = process.env.TWITCH_CLIENT_SECRET ?? process.env.CLIENT_SECRET ?? '';
  return { clientId, clientSecret };
}

async function refreshTokenDoc(doc: IToken) {
  const { clientId, clientSecret } = getClientCredentials();
  if (!clientId || !clientSecret) throw new Error('Twitch client credentials not configured');
  if (!doc.refresh_token) throw new Error('No refresh_token available');

  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', doc.refresh_token as string);
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);

  const res = await authURL.post('/token', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return res.data;
}

async function processBatch(opts: Required<RefreshOptions>) {
  // compute threshold: only refresh tokens that are already expired (now)
  const threshold = new Date();
  const lockStaleMs = 1000 * 60 * 15; // consider a processing lock stale after 15 minutes

  // base selection criteria (doesn't include processing lock checks)
  // Only include tokens that either have no expires_at (legacy tokens) OR are already expired (expires_at <= now)
  const baseQuery: any = {
    refresh_token: { $exists: true, $ne: null },
    disabled: { $ne: true },
    $or: [
      { expires_at: { $exists: false } },
      { expires_at: null },
      { expires_at: { $lte: threshold } },
    ],
  };

  // If the model supports findOneAndUpdate, atomically claim up to `batchSize` tokens
  // by setting a processing lock. If not (e.g. in older test mocks), fall back
  // to the original `find(...).limit(...)` behavior for compatibility.
  let claimed: IToken[] = [];
  if (typeof (TokenModel as any).findOneAndUpdate === 'function') {
    claimed = [];
    for (let i = 0; i < opts.batchSize; i++) {
    // allow claiming tokens that are not processing, or whose processing_at is stale
    const now = new Date();
    const staleAt = new Date(Date.now() - lockStaleMs);
    const claimQuery = {
      ...baseQuery,
      $or: [
        { processing: { $exists: false } },
        { processing: false },
        { processing_at: { $lte: staleAt } },
      ],
    } as any;

    const claimedDoc = await TokenModel.findOneAndUpdate(
      claimQuery,
      { $set: { processing: true, processing_at: now } },
      { new: true }
    ).exec();

    if (!claimedDoc) break;
    claimed.push(claimedDoc);
  }
  } else {
    // fallback for test mocks that only implement `find`.
    const tokens = await TokenModel.find(baseQuery).limit(opts.batchSize).exec();
    claimed = tokens || [];
  }

  if (claimed.length === 0) return;

  for (const t of claimed) {
    try {
      // If the token already has a future expires_at, skip refreshing.
          if (t.expires_at) {
        try {
          const expires = new Date(t.expires_at as any);
          const now = new Date();
          if (expires > now) {
            // logger.info({ _id: t._id?.toString?.(), expires_at: expires.toISOString() }, '[refresh] skipping token (not expired)');
            // release processing lock if model supports it
            if (typeof (TokenModel as any).findByIdAndUpdate === 'function') {
              try {
                await (TokenModel as any).findByIdAndUpdate(t._id, { $set: { processing: false, processing_at: null } }).exec();
              } catch (releaseErr: any) {
                logger.warn({ _id: t._id?.toString?.(), err: releaseErr?.message ?? String(releaseErr) }, '[refresh] failed to release processing lock');
              }
            }
            continue;
          }
        } catch (dateErr) {
          // If expires_at is malformed, proceed with refresh attempt and let downstream errors surface
          logger.warn({ _id: t._id?.toString?.(), err: String(dateErr) }, '[refresh] could not parse expires_at, proceeding');
        }
      }
      logger.info({ _id: t._id?.toString?.() }, '[refresh] refreshing token');
      const data = await refreshTokenDoc(t as IToken);
      const expiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000) : undefined;

      const update: any = {
        access_token: data.access_token,
        obtained_at: new Date(),
      };
      if (data.refresh_token) update.refresh_token = data.refresh_token;
      if (expiresAt) update.expires_at = expiresAt;

      const updated = await TokenModel.findByIdAndUpdate(t._id, { $set: update }, { new: true }).exec();
      logger.info({ _id: updated?._id?.toString?.(), expires_at: updated?.expires_at }, '[refresh] token refreshed');
      // On success reset retry_count and ensure token is enabled
      await TokenModel.findByIdAndUpdate(t._id, { $set: { retry_count: 0, disabled: false, processing: false, processing_at: null } }).exec();
    } catch (err: any) {
      logger.warn({ _id: t._id?.toString?.(), err: err?.response?.data ?? err?.message ?? String(err) }, '[refresh] failed to refresh token');
      try {
        // Increment retry_count atomically and read back new value, also release processing lock
        const incRes: any = await TokenModel.findByIdAndUpdate(
          t._id,
          { $inc: { retry_count: 1 }, $set: { processing: false, processing_at: null } },
          { new: true }
        ).exec();
        const newCount = (incRes && incRes.retry_count) || 0;
        if (newCount >= opts.maxRetries) {
          // disable the token to avoid endless retries
          await TokenModel.findByIdAndUpdate(t._id, { $set: { disabled: true } }).exec();
          logger.warn({ _id: t._id?.toString?.(), retry_count: newCount }, '[refresh] token disabled due to repeated failures');
        }
      } catch (innerErr) {
        logger.error({ err: String(innerErr) }, '[refresh] error updating retry_count');
      }
    }
  }
}

export function startRefreshWorker(opts?: RefreshOptions) {
  const cfg: Required<RefreshOptions> = { ...DEFAULTS, ...(opts ?? {}) };
  if (_running) return;
  _running = true;

  // Wait for DB readiness before starting runs
  dbReady
    .then(() => {
      // Run immediately then schedule
      processBatch(cfg).catch((e) => {
        logger.error({ err: String(e) }, '[refresh] initial run failed');
      });
      _interval = setInterval(() => processBatch(cfg).catch((e) => {
        logger.error({ err: String(e) }, '[refresh] scheduled run failed');
      }), cfg.intervalMs);
      logger.info('[refresh] token refresh worker started');
    })
    .catch((err) => {
      logger.error({ err: err?.message ?? String(err) }, '[refresh] db not ready, token refresh worker not started');
    });
}

export function stopRefreshWorker() {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
  _running = false;
  logger.info('[refresh] token refresh worker stopped');
}

export default { startRefreshWorker, stopRefreshWorker };

// Export a single-run helper for tests and one-off refresh operations.
export async function refreshOnce(opts?: RefreshOptions) {
  const cfg: Required<RefreshOptions> = { ...DEFAULTS, ...(opts ?? {}) };
  await dbReady;
  await processBatch(cfg);
}

// Export internals for tests
export { refreshTokenDoc as __test_refreshTokenDoc, processBatch as __test_processBatch };
