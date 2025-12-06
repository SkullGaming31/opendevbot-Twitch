import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { helix } from './auth/API';

import { exchangeCodeForToken, saveOrUpdateToken, attachUserIdToToken } from './auth/twitch';
import { buildAuthorizeUrl, CHANNEL_SCOPES, MODERATION_SCOPES, SCOPES } from './auth/scopes';
import { startRefreshWorker } from './auth/refresh';

const app = express();
app.use(express.json());

const API_PREFIX = '/api/v1';

// Redirect-based route: sends the developer to Twitch's authorize page
app.get(`${API_PREFIX}/twitch`, (req, res) => {
  const clientId = process.env.TWITCH_CLIENT_ID ?? process.env.CLIENT_ID ?? '';
  const redirect = process.env.TWITCH_REDIRECT_URI ?? process.env.REDIRECT_URI ?? 'http://localhost:3000/api/v1/auth/twitch/callback';

  const scopes = [
    // request channel + moderation + chat scopes by default for the bot
    ...CHANNEL_SCOPES,
    ...MODERATION_SCOPES,
    SCOPES.CHAT_READ,
    SCOPES.CHAT_EDIT,
    SCOPES.CHANNEL_BOT,
  ];

  const url = buildAuthorizeUrl({ clientId, redirectUri: redirect, scopes, forceVerify: true });
  // Redirect the browser to Twitch's authorize URL
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
      const doc: any = created;
      console.log('Token saved:', {
        _id: doc?._id?.toString?.() ?? null,
        user_id: doc?.user_id ?? null,
        scopes: doc?.scopes ?? scopes,
        expires_at: doc?.expires_at ?? tokenData.expires_at ?? null,
        obtained_at: doc?.obtained_at ?? new Date().toISOString(),
      });
    } catch (e) {
      console.log('Token saved (could not format):', String(e));
    }

    // Resolve user id via Helix API and attach to token doc
    const userResp = await helix.get('/users', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Client-Id': clientId,
      },
    });

    const userId = userResp?.data?.data?.[0]?.id;
    if (userId && created && typeof (created as any)._id !== 'undefined') {
      const updated = await attachUserIdToToken((created as any)._id.toString(), userId);
      // Log update result for verification
      try {
        const u: any = updated;
        console.log('Token updated with user_id:', {
          _id: u?._id?.toString?.() ?? null,
          user_id: u?.user_id ?? userId,
          scopes: u?.scopes ?? scopes,
        });
      } catch (e) {
        console.log('Token updated (could not format):', String(e));
      }
    }

    res.send('Authorization successful — token saved. You can close this window.');
  } catch (err) {
    console.error('OAuth callback error', err);
    res.status(500).send('OAuth exchange failed');
  }
});

// Start background workers (non-blocking). Worker waits for DB readiness internally.
startRefreshWorker();

// const port = Number(process.env.PORT || 3000);
// app.listen(port, () => console.log(`Server listening on http://localhost:${port}${API_PREFIX}`));

export default app;
