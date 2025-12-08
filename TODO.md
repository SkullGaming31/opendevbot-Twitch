# TODO — OpenDevBot Production & Multi-Channel Hosting

> **Public repository file — do not commit secrets.**
>
> This file is public. Never include real secrets, credentials, tokens, or `.env` contents here. Use placeholder names (e.g. `MONGO_URI`, `CLIENT_ID`) and instruct operators to store real values in environment variables or a secret manager. Do not add any real tokens or client secrets to this file or any committed files.

This file captures the actionable tasks to make OpenDevBot ready for hosting multiple Twitch channels. Tasks are prioritized and grouped so you can pick immediate work to implement.

## Quick summary (what the host must provide)

- A public, HTTPS callback URL (set `REDIRECT_URI` and register it in Twitch Dev Console).
- A running MongoDB instance (`MONGO_URI`) for token and subscription storage.
- A Twitch Developer App (`CLIENT_ID` and `CLIENT_SECRET`).
- An `EVENTSUB_SECRET` for webhook verification.

---

## Focused checklist — Multi-channel hosting (priority order)

1. Per-channel tokens & linking

- Use `TokenModel` as the canonical per-channel auth record. Token documents must include `user_id`, `access_token`, `refresh_token`, `scopes`, `expires_at`, and `obtained_at`.
- After OAuth callback persist tokens via `saveOrUpdateToken()` and attach `user_id` (the server currently does this).

1. Automatic token refresh (critical)

- Implement `src/auth/refresh.ts` that finds tokens close to expiry and exchanges `refresh_token` for a new `access_token`.
- Update DB fields and implement retry/backoff. Mark tokens invalid after repeated failures and notify admin.

1. Chat client manager (native Twitch IRC client — no external chat libraries)

- Implement `src/chat/index.ts` as a native Twitch IRC/IRCv3 client using Node's `net`/`tls` or WebSocket APIs (no `tmi.js` or similar libraries).
- Required behaviors:
- Connect to `irc.chat.twitch.tv:6697` (TLS) and authenticate using `PASS oauth:<token>` and `NICK <botname>`.
- Request IRCv3 capabilities: `CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership` to receive structured tags and commands.
- Handle `PING` / `PONG`, automatic reconnect with exponential backoff, and idle/timeouts.
  - Parse IRC messages including IRCv3 tags into structured JS objects (message, user, badges, emotes, tags).
  - Implement outgoing message queueing with per-channel and global throttles to respect Twitch rate limits (message limits, commands per 30s, etc.).
  - Support join/part for channels stored in DB and allow dynamic join/leave when channels authorize or are removed.
  - Emit high-level events for chat messages, joins/parts, notices, and moderation events so other parts of the system can subscribe.
  - Log connection state and errors (structured logs) and surface metrics (e.g., connections, messages/sec, reconnects).

- Rate-limit guidance (implement in the client):
- Per-connection: default ~20 messages per 30 seconds per bot in a given channel (check Twitch docs and update for verified bots/whitelists).
- Implement per-channel token bucket or leaky-bucket and a global queue to ensure you do not exceed caps.

- Security note: never persist plain user OAuth tokens in logs; always redact or encrypt secrets at rest.

1. EventSub per-channel subscription lifecycle

- On successful OAuth for a broadcaster, create EventSub subscriptions for that broadcaster and store subscription ids in DB.
- Add periodic renewal and cleanup for these subscriptions.

1. EventSub webhook verification & challenge handling

- Verify `Twitch-Eventsub-Message-Signature` using `EVENTSUB_SECRET` for every webhook request.
- Respond to the initial challenge with the provided challenge string during subscription verification.

1. Onboarding and connect endpoint

- Provide a simple `/connect` page or endpoint that builds the authorize URL and redirects the broadcaster.
- After callback show a friendly success page explaining any next steps (e.g., run `/mod <BotName>` if moderation is required).

1. Health/readiness and graceful shutdown

- Add `GET /health` and `GET /ready` (where `ready` awaits `dbReady` and chat client readiness).
- Handle `SIGINT`/`SIGTERM` to leave channels, stop workers, and close the DB connection cleanly.

1. Security, rate limits & scaling

- Harden the API with `helmet`, restrict origins via `cors`, and add `express-rate-limit` on public endpoints.
- Use a job queue (BullMQ/agenda) for refresh and subscription tasks and use distributed locks for subscription renewal when scaled.

1. Migration, docs & ops

- Add `.env.example`, update `README.md` with setup and OAuth instructions, and provide Docker + docker-compose for local dev.

1. Monitoring & observability

- Add structured logging (Pino), error reporting (Sentry), and `/metrics` (Prometheus `prom-client`).

---

## Immediate implementation choices (pick one)

### NOTE: this will be from scratch there will be no twitch Library used.

- **A)** Chat client manager using `tmi.js` (recommended if OpenDevBot uses a single shared bot account). I will add `src/chat/index.ts` and wire it to startup.
- **B)** Token refresh worker and scheduler (recommended — critical for uptime). I will add `src/auth/refresh.ts` and a simple scheduler.
- **C)** EventSub subscription creation at OAuth callback time and persistence (recommended to start receiving events). I will add subscription creation code and DB storage.

---

Recorded tasks are also tracked in the project's todo manager.


access the database
docker exec -it opendevbot-mongo mongosh

### Session 2 Summary (2025-12-06)

- Optional raw IRC debug (CHAT_DEBUG_RAW) added to src/chat/TwitchChatClient.ts.
- Bot no longer logs when skipping auto-join for its own channel (src/chat/index.ts).
- Simple !ping → pong! command implemented in src/index.ts.
- Full message logging made opt-in via CHAT_LOG_FULL in src/index.ts.
- Helper scripts added: scripts/printToken.ts, scripts/getUserId.ts.
- .env.example added documenting chat and logging env vars.

