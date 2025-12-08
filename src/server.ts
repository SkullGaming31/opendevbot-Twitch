import dotenv from 'dotenv';
dotenv.config({ debug: false });

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import client from 'prom-client';
import logger from './logger';
import { helix } from './auth/API';

import { exchangeCodeForToken, saveOrUpdateToken, attachUserIdToToken } from './auth/twitch';
import { buildAuthorizeUrl, BOT_SCOPES, SCOPES } from './auth/scopes';
import { startRefreshWorker } from './auth/refresh';

const app = express();
app.use(express.json());

// Security middleware
app.use(helmet());
const corsOrigin = process.env.CORS_ORIGIN ?? '*';
app.use(cors({ origin: corsOrigin }));

// Rate limiting (configurable via env)
const rateWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const rateMax = Number(process.env.RATE_LIMIT_MAX ?? 100);
app.use(
  rateLimit({
    windowMs: rateWindowMs,
    max: rateMax,
  })
);

// Request logging middleware using centralized logger
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'incoming request');
  (req as unknown as { logger?: unknown }).logger = logger;
  next();
});

const API_PREFIX = '/api/v1';

// Prometheus metrics
client.collectDefaultMetrics();
app.get(`${API_PREFIX}/metrics`, async (_req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).send(String(err));
  }
});

// Redirect-based route: sends the developer to Twitch's authorize page
app.get(`${API_PREFIX}/twitch/bot`, (req, res) => {
  const clientId = process.env.TWITCH_CLIENT_ID ?? process.env.CLIENT_ID ?? '';
  const redirect = process.env.TWITCH_REDIRECT_URI ?? process.env.REDIRECT_URI ?? 'http://localhost:3000/api/v1/auth/twitch/callback';

  // Request all available scopes except `channel:bot` (bot first auth requirement)
  const scopes = BOT_SCOPES;

  const url = buildAuthorizeUrl({ clientId, redirectUri: redirect, scopes, forceVerify: true });
  // Redirect the browser to Twitch's authorize URL
  res.redirect(url);
});

// User-specific authorize route: request only `channel:bot` for a user account
app.get(`${API_PREFIX}/twitch/user`, (req, res) => {
  const clientId = process.env.TWITCH_CLIENT_ID ?? process.env.CLIENT_ID ?? '';
  const redirect = process.env.TWITCH_REDIRECT_URI ?? process.env.REDIRECT_URI ?? 'http://localhost:3000/api/v1/auth/twitch/callback';
  const scopes = [SCOPES.CHANNEL_BOT];
  const url = buildAuthorizeUrl({ clientId, redirectUri: redirect, scopes, forceVerify: true });
  res.redirect(url);
});

// OAuth callback - Twitch will redirect here with ?code=...
// New path per routing convention: /api/v1/auth/twitch/callback
app.get(`${API_PREFIX}/auth/twitch/callback`, async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  if (!code) return res.status(400).send('Missing code');

  try {
    const redirectUri = process.env.TWITCH_REDIRECT_URI ?? process.env.REDIRECT_URI ?? 'http://localhost:3001/api/v1/auth/twitch/callback';
    const clientId = process.env.TWITCH_CLIENT_ID ?? process.env.CLIENT_ID ?? '';
    const clientSecret = process.env.TWITCH_CLIENT_SECRET ?? process.env.CLIENT_SECRET ?? '';

    const tokenData = await exchangeCodeForToken(code, redirectUri, clientId, clientSecret);

    const scopes = tokenData.scope
      ? Array.isArray(tokenData.scope)
        ? tokenData.scope
        : String(tokenData.scope).split(' ')
      : [];

    // Save token first (may create document without user_id)
    const created = await saveOrUpdateToken({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      scopes,
      obtained_at: new Date().toISOString(),
    });

    // Log redacted token info for verification (do not log raw tokens)
    try {
      const doc = created as unknown as { _id?: { toString?: () => string }; user_id?: string; scopes?: unknown; expires_at?: unknown; obtained_at?: unknown };
      logger.info({
        _id: doc?._id?.toString?.() ?? null,
        user_id: doc?.user_id ?? null,
        scopes: doc?.scopes ?? scopes,
        expires_at: doc?.expires_at ?? tokenData.expires_at ?? null,
        obtained_at: doc?.obtained_at ?? new Date().toISOString(),
      }, 'Token saved');
    } catch (e) {
      logger.warn({ err: String(e) }, 'Token saved (could not format)');
    }

    // Resolve user id via Helix API and attach to token doc
    const userResp = await helix.get('/users', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Client-Id': clientId,
      },
    });

    const userId = userResp?.data?.data?.[0]?.id;
    if (userId && created) {
      const maybeId = (created as unknown as { _id?: { toString?: () => string } })._id;
      if (maybeId && typeof maybeId.toString === 'function') {
        const idStr = maybeId.toString();
        const updated = await attachUserIdToToken(idStr, userId);
        // Log update result for verification
        try {
          const u = updated as unknown as { _id?: { toString?: () => string }; user_id?: string; scopes?: unknown };
          logger.info({
            _id: u?._id?.toString?.() ?? null,
            user_id: u?.user_id ?? userId,
            scopes: u?.scopes ?? scopes,
          }, 'Token updated with user_id');
        } catch (e) {
          logger.warn({ err: String(e) }, 'Token updated (could not format)');
        }
      }
    }
    res.send('Authorization successful — token saved. You can close this window.');
  } catch (err: unknown) {
    if (err instanceof Error) {
      logger.error({ err: err?.message ?? String(err) }, 'OAuth callback error');
      res.status(500).send('OAuth exchange failed');
    }
  }
});

// Start background workers (non-blocking). Worker waits for DB readiness internally.
startRefreshWorker();

export default app;
