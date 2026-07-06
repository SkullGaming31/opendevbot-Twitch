import dotenv from 'dotenv';
// Ensure Web Crypto API is available (Node 18+ exposes webcrypto but not globalThis.crypto)
try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { webcrypto } = require('node:crypto');
	if (!(globalThis as any).crypto) (globalThis as any).crypto = webcrypto;
} catch {
	// ignore if unavailable
}
// Load env early so other modules (logger, server) see the configured values
dotenv.config({ debug: false, quiet: true });
import { dbReady } from './Database';
import type { EventSubClient as EventSubClientType } from './Events';
import { buildAuthorizeUrl, CHANNEL_SCOPES, MODERATION_SCOPES } from './auth/scopes';
import app from './server';
import logger from './logger';

/**
 * Tiny startup example - initializes DB and prints an authorize URL for the
 * bot account (OpenDevBot). This is intended as a developer convenience so
 * you can copy the URL to a browser and complete the OAuth flow for the bot.
 */
async function main() {
	// Observe DB readiness — `src/Database` will auto-initialize the connection.
	try {
		const conn = await dbReady;
		if (conn) logger.info('Connected to MongoDB');
		else logger.warn('DB not connected (set MONGO_URI to enable DB).');
	} catch (err: unknown) {
		logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'DB initialization failed');
	}

	const clientId = process.env.CLIENT_ID as string;
	const redirect = process.env.REDIRECT_URI as string;

	// Example authorize URL for the bot account (OpenDevBot) with chat scopes
	const url = buildAuthorizeUrl({
		clientId,
		redirectUri: redirect,
		scopes: [
			...CHANNEL_SCOPES,
			...MODERATION_SCOPES
		],
		forceVerify: false,
	});
	// Log the example authorize URL for developer convenience (redacted by default in logs)
	logger.info({ authorizeUrl: url }, 'Example authorize URL');
}

main().catch((err: unknown) => {
	if (err instanceof Error) {
		logger.error(err.message);
		process.exit(1);
	}
});

// Start the HTTP server from the main entrypoint so startup logging is deterministic
const port = Number(process.env.PORT ?? 3001);
const API_PREFIX = '/api/v1';
app.listen(port, () => {
	logger.info(`Server listening on http://localhost:${port}${API_PREFIX}`);
	// console.log(`Server listening on http://localhost:${port}${API_PREFIX}`);
});

// Optionally start chat manager if enabled via `CHAT_ENABLED=true`
if (process.env.CHAT_ENABLED === 'true') {
	(async () => {
		try {
			// Dynamic import so tests that don't need chat won't load it
			const chatModule = await import('./chat');
			const chatManager = (chatModule as unknown as { default: unknown }).default as unknown;

			try {
				const loader = await import('./Commands/core/loader');
				const pathMod = await import('path');
				const commandsDir = pathMod.join(__dirname, 'Commands');
				const commands = await (loader as unknown as { loadCommands?: (dir: string, lg?: unknown) => unknown }).loadCommands!(commandsDir, logger as unknown);
				(chatManager as unknown as { __commands?: Map<string, unknown> }).__commands = commands as unknown as Map<string, unknown>;
				(chatManager as unknown as { __commandLastUsed?: Map<string, number> }).__commandLastUsed = new Map();
			} catch (err) {
				logger.warn({ err: String(err) }, 'Failed to initialize chat commands');
			}

			// Attach built-in listeners so the bot handles incoming messages in-process
			(chatManager as { on?: (ev: string, fn: unknown) => void }).on?.('connected', () => logger.info('chat manager connected'));
			(chatManager as { on?: (ev: string, fn: unknown) => void }).on?.('disconnected', (d: unknown) => logger.info({ d }, 'chat manager disconnected'));
			(chatManager as { on?: (ev: string, fn: unknown) => void }).on?.('error', (e: unknown) => logger.warn({ err: String(e) }, 'chat manager error'));
			(chatManager as { on?: (ev: string, fn: unknown) => void }).on?.('raw', (m: unknown) => logger.debug({ m }, 'chat raw'));

			const dispatcher = await import('./Commands/dispatcher');
			const dispatcherMod = dispatcher as unknown as { handleMessage?: (m: unknown, chatManager: unknown, logger: unknown) => Promise<void> };
			(chatManager as unknown as { on?: (ev: string, fn: unknown) => void }).on?.('message', (m: unknown) => dispatcherMod.handleMessage?.(m, chatManager, logger).catch((e: unknown) => logger.warn({ err: String(e) }, 'dispatch failed')));

			(chatManager as { start?: () => Promise<void> }).start?.().catch((err: unknown) => logger.warn({ err: String(err) }, 'chat manager failed to start'));
		} catch (err) {
			logger.warn({ err: String(err) }, 'Failed to initialize chat manager');
		}
	})();
}

// Optionally start EventSub websocket client if enabled via `EVENTS_ENABLED=true`
if (process.env.EVENTS_ENABLED === 'true') {
	(async () => {
		try {
			const eventsModule = await import('./Events');
			const EventSubClientCtor = (eventsModule as unknown as { EventSubClient: new (opts?: unknown) => EventSubClientType }).EventSubClient;
			const wsUrl = process.env.EVENTS_WS_URL as string | undefined;
			const reconnectMs = Number(process.env.EVENTS_RECONNECT_MS ?? '5000');
			const client = new EventSubClientCtor({ url: wsUrl, reconnectIntervalMs: reconnectMs });

			client.on('connected', () => logger.info('EventSub websocket connected'));
			client.on('disconnected', (d: unknown) => logger.info({ d }, 'EventSub websocket disconnected'));
			client.on('error', (e: unknown) => logger.warn({ err: String(e) }, 'EventSub websocket error'));
			client.on('raw', (m: unknown) => logger.debug({ m }, 'eventsub raw'));

			client.connect();
		} catch (err) {
			logger.warn({ err: String(err) }, 'Failed to initialize EventSub client');
		}
	})();
}