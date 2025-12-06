<!-- Auto-generated guidance for AI coding agents working on this repo. -->
# Copilot / AI agent instructions for this repository

Purpose: quickly orient an AI coding agent to the codebase layout, conventions, and run/debug patterns so it can be immediately productive.

- Project type: small TypeScript Node project focused on Twitch integration (OAuth + EventSub).
- Location of interest:
  - `src/index.ts` — application entry (currently a placeholder).
  - `src/auth/API.ts` — central axios instances used for Twitch API calls (`authURL`, `eventSubscribe`).
  - `src/auth/twitch.ts` — Twitch auth module (implementation area for token flows).
  - `src/auth/tokens/` — local JSON token fixtures; file pattern: `{userId}.token.json`.

Key architecture & patterns (discoverable in code):
- Separation of concerns: HTTP clients are configured in `src/auth/API.ts` and exported for reuse. Use `authURL` for OAuth endpoints (base `https://id.twitch.tv/oauth2`) and `eventSubscribe` for EventSub (base `https://api.twitch.tv/helix/eventsub/subscriptions`).
- Token storage: test/example tokens are persisted as JSON files in `src/auth/tokens/`. Each token file contains fields: `access_token`, `refresh_token`, `expires_at`, `scopes`, `obtained_at`, `user_id`.
 - Token storage: test/example tokens were previously persisted as JSON files in `src/auth/tokens/`. This project now prefers storing tokens in MongoDB using `mongoose`.
   - New files: `src/Database/index.ts` (connection helper) and `src/Database/models/token.ts` (Mongoose model).
   - Install dependencies: `npm install mongoose @types/mongoose` and set `MONGO_URI` in `.env` or your environment.
 - Scopes: scope constants and helpers are centralized in `src/auth/scopes.ts`. Use `buildAuthorizeUrl` to build OAuth authorize URLs and `SCOPES` to reference specific scopes (e.g., `chat:read`, `chat:edit`, `channel:bot`).
- Environment configuration: `dotenv` is a dependency — expect runtime secrets as environment variables (e.g., `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, webhook secret). Search the code for `process.env` to discover exact variable names before using them.

Developer workflows (how to run/typecheck/test):
- Install deps: `npm install` (or `pnpm`/`yarn` if you prefer, but package.json currently uses npm-format deps).
- Run TypeScript code interactively: `npx ts-node src/index.ts` (the project currently lacks `scripts` in package.json).
- Type-check only: `npx tsc --noEmit` (there is no populated `tsconfig.json` in the repo root; if missing, create one or use `ts-node` for quick runs).
- Tests: `npx vitest` (devDependency present). Use `vitest` CLI for unit tests.

Project-specific conventions and guidelines for edits:
- Reuse the exported axios instances in `src/auth/API.ts` rather than creating new axios clients for the same endpoints.
- Token files under `src/auth/tokens/` are fixtures for testing — do NOT commit real credentials. Prefer `.env` for real secrets and add any real token files to `.gitignore`.
- When adding new API calls, put request helpers in `src/auth/` and export small, testable functions from `src/auth/twitch.ts` (it is the natural place for OAuth flows).
- Follow the existing JSON token shape when reading/writing token files; new consumers should validate `expires_at` / `obtained_at` timestamps and refresh tokens when expired.

Integration points & external dependencies:
- Twitch OAuth: uses `https://id.twitch.tv/oauth2` via `authURL`.
- Twitch EventSub: uses `https://api.twitch.tv/helix/eventsub/subscriptions` via `eventSubscribe`.
- HTTP client: `axios` is the canonical dependency — prefer its configured instances instead of ad-hoc `axios.create` calls.
- Config: `dotenv` expected; ensure `require('dotenv').config()` or equivalent is called early (e.g., in `src/index.ts`) before reading `process.env`.

What to look for when changing code:
- If you add or change authentication code, update examples in `src/auth/tokens/` so tests and manual runs have clear fixtures.
- If adding integration tests, prefer to mock axios instances (imported from `src/auth/API.ts`) rather than patching `axios` globally.
- Keep secrets out of repo: flag any literal tokens in commits and prefer environment variables.

Examples from the codebase:
- Using axios clients (from `src/auth/API.ts`):
  - `import { authURL } from './auth/API';` then `authURL.post('/token', { ... })` for OAuth token exchange.
- Token file example (fixture path): `src/auth/tokens/1234.token.json` — includes `access_token`, `refresh_token`, `expires_at`.

If you cannot find required variables or scripts:
- Run a global search for `process.env` to discover env var names.
- Check `package.json` for missing `scripts` — add `scripts` entries if you need consistent CLI shortcuts (ask a human reviewer before changing package.json).

When asking for human review:
- Summarize any environment variable additions and confirm where secrets will be stored.
- If proposing to change token storage (file → DB), provide a migration plan and tests that keep existing fixtures working.

Contact points: leave TODO comments linking to `src/auth/twitch.ts` when you implement flows so reviewers can find authentication code quickly.

— end of file —
