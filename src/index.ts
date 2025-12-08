import dotenv from 'dotenv';
// Load env early so other modules (logger, server) see the configured values
dotenv.config({ debug: false, quiet: true });
import { dbReady } from './Database';
import { buildAuthorizeUrl, CHANNEL_SCOPES, MODERATION_SCOPES, SCOPES } from './auth/scopes';
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
	// Lazy-require to avoid loading chat code during tests by default
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const chatManager = require('./chat').default;
	// Load command modules from `src/commands` (optional folder). Each file should export default { name, aliases?, cooldownMs?, execute }
	// Commands are registered by lowercase name and aliases.
	try {
		// lazy import to avoid circular requires during startup
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { loadCommands } = require('./commands/loader');
		const commandsDir = require('path').join(__dirname, 'commands');
		const commands = loadCommands(commandsDir, logger as any);
		(chatManager as any).__commands = commands;
		(chatManager as any).__commandLastUsed = new Map();
	} catch (err) {
		logger.warn({ err: String(err) }, 'Failed to initialize chat commands');
	}
	// Attach built-in listeners so the bot handles incoming messages in-process
	chatManager.on('connected', () => logger.info('chat manager connected'));
	chatManager.on('disconnected', (d: any) => logger.info({ d }, 'chat manager disconnected'));
	chatManager.on('error', (e: any) => logger.warn({ err: String(e) }, 'chat manager error'));
	chatManager.on('raw', (m: any) => logger.debug({ m }, 'chat raw'));
	chatManager.on('message', (m: any) => {
		try {
			const channel = m.channel ?? '<unknown>';
			const display = (m.tags && (m.tags['display-name'] || m.tags['login'])) || m.prefix || 'unknown';
			const text = m.text ?? (m.params && m.params[1]) ?? '';
			// Log common chat fields; include full parsed message when opt-in
			const logPayload: any = { channel, display, text };
			if (process.env.CHAT_LOG_FULL === 'true') {
				logPayload.message = m;
			}
			logger.info(logPayload, 'chat message');

			// Auto-detect privilege from tags and update rate-limiter
			try {
				const badgesRaw = m.tags && m.tags.badges ? String(m.tags.badges) : '';
				const badges = badgesRaw ? badgesRaw.split(',').map((b: string) => b.split('/')[0]) : [];
				const isPriv = badges.includes('broadcaster') || badges.includes('moderator') || badges.includes('vip');
				if (isPriv) chatManager.setChannelPrivilege(channel, true);
			} catch (e) {
				// ignore badge parsing errors
			}

			// Command dispatching: messages starting with '!'
			try {
				if (typeof text === 'string' && text.trim().startsWith('!')) {
					const parts = text.trim().slice(1).split(/\s+/);
					const invoked = parts[0] ? String(parts[0]).toLowerCase() : '';
					const args = parts.slice(1);
					const commands = (chatManager as any).__commands as Map<string, any> | undefined;
					const lastUsed = (chatManager as any).__commandLastUsed as Map<string, number> | undefined;
					const cmd = commands?.get(invoked);
					if (cmd && typeof cmd.execute === 'function') {
						const now = Date.now();
						const cooldown = Number(cmd.cooldownMs || cmd.cooldown || 0) || 0;
						const last = lastUsed?.get(cmd.name) || 0;
						if (cooldown > 0 && now - last < cooldown) {
							logger.debug({ command: cmd.name, channel }, 'command on cooldown');
						} else {
							try {
								lastUsed?.set(cmd.name, now);
								Promise.resolve(cmd.execute({ channel, display, text, args, chatManager, raw: m, logger, commands: (chatManager as any).__commands }))
									.catch((err: any) => logger.warn({ err: String(err), command: cmd.name }, 'chat command execution failed'));
							} catch (ex) {
								logger.warn({ err: String(ex), command: cmd.name }, 'chat command execution error');
							}
						}
					}
				}
			} catch (e) {
				logger.warn({ err: String(e) }, 'chat command handler failed');
			}
		} catch (e) {
			logger.warn({ err: String(e) }, 'chat message handler failed');
		}
	});

	chatManager.start().catch((err: any) => logger.warn({ err: String(err) }, 'chat manager failed to start'));
}