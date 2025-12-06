import dotenv from 'dotenv';
import { dbReady } from './Database';
import { buildAuthorizeUrl, CHANNEL_SCOPES, MODERATION_SCOPES, SCOPES } from './auth/scopes';
import app from './server';

dotenv.config();

/**
 * Tiny startup example - initializes DB and prints an authorize URL for the
 * bot account (OpenDevBot). This is intended as a developer convenience so
 * you can copy the URL to a browser and complete the OAuth flow for the bot.
 */
async function main() {
	// Observe DB readiness — `src/Database` will auto-initialize the connection.
	try {
		const conn = await dbReady;
		if (conn) console.log('Connected to MongoDB');
		else console.warn('DB not connected (set MONGO_URI to enable DB).');
	} catch (err: unknown) {
		console.warn('DB initialization failed:', err instanceof Error ? err.message : String(err));
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

	console.log('Authorize the bot account OpenDevBot at:');
	// console.log(url);

	app.listen(3001, () => { console.log('Server listening on http://localhost:3001'); });
}

main().catch((err: unknown) => {
  if (err instanceof Error) {
    console.error(err.message);
    process.exit(1);
  }
});