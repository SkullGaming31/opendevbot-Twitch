import { authURL } from './API';
import { TokenModel, IToken } from '../Database/models/token';
import { dbReady } from '../Database';

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
  // compute threshold
  const threshold = new Date(Date.now() + opts.lookAheadMs);

  const query = {
    refresh_token: { $exists: true, $ne: null },
    disabled: { $ne: true },
    $or: [
      { expires_at: { $exists: false } },
      { expires_at: null },
      { expires_at: { $lte: threshold } },
    ],
  } as any;

  const tokens = await TokenModel.find(query).limit(opts.batchSize).exec();
  if (!tokens || tokens.length === 0) return;

  for (const t of tokens) {
    try {
      console.log(`[refresh] refreshing token _id=${t._id}`);
      const data = await refreshTokenDoc(t as IToken);
      const expiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000) : undefined;

      const update: any = {
        access_token: data.access_token,
        obtained_at: new Date(),
      };
      if (data.refresh_token) update.refresh_token = data.refresh_token;
      if (expiresAt) update.expires_at = expiresAt;

      const updated = await TokenModel.findByIdAndUpdate(t._id, { $set: update }, { new: true }).exec();
      console.log('[refresh] token refreshed:', { _id: updated?._id?.toString?.(), expires_at: updated?.expires_at });
      // On success reset retry_count and ensure token is enabled
      await TokenModel.findByIdAndUpdate(t._id, { $set: { retry_count: 0, disabled: false } }).exec();
    } catch (err: any) {
      console.warn('[refresh] failed to refresh token', t._id?.toString?.(), err?.response?.data ?? err?.message ?? String(err));
      try {
        // Increment retry_count atomically and read back new value
        const incRes: any = await TokenModel.findByIdAndUpdate(t._id, { $inc: { retry_count: 1 } }, { new: true }).exec();
        const newCount = (incRes && incRes.retry_count) || 0;
        if (newCount >= opts.maxRetries) {
          // disable the token to avoid endless retries
          await TokenModel.findByIdAndUpdate(t._id, { $set: { disabled: true } }).exec();
          console.warn('[refresh] token disabled due to repeated failures', t._id?.toString(), { retry_count: newCount });
        }
      } catch (innerErr) {
        console.error('[refresh] error updating retry_count', innerErr);
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
      processBatch(cfg).catch((e) => console.error('[refresh] initial run failed', e));
      _interval = setInterval(() => processBatch(cfg).catch((e) => console.error('[refresh] scheduled run failed', e)), cfg.intervalMs);
      console.log('[refresh] token refresh worker started');
    })
    .catch((err) => {
      console.error('[refresh] db not ready, token refresh worker not started', err?.message ?? String(err));
    });
}

export function stopRefreshWorker() {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
  _running = false;
  console.log('[refresh] token refresh worker stopped');
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
