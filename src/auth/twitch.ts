import { authURL } from './API';
import { TokenModel, IToken, TokenInput } from '../Database';

/**
 * DB-backed token helpers for storing and retrieving Twitch tokens.
 * The database connection is auto-initialized by `src/Database/index.ts`.
 */

export async function getTokenByUserId(userId: string): Promise<IToken | null> {
	return TokenModel.findOne({ user_id: userId }).exec();
}

export async function saveOrUpdateToken(token: TokenInput) {
	const now = token.obtained_at ? new Date(token.obtained_at) : new Date();

	const update: Partial<Record<string, unknown>> = {
		access_token: token.access_token as string | undefined,
		refresh_token: token.refresh_token,
		scopes: (token.scopes as string[]) || [],
		expires_at: token.expires_at ? new Date(token.expires_at) : undefined,
		obtained_at: now,
	};

	// If we have a user_id, update (or upsert) by user_id. If not, create
	// a new token document and return it so the caller can attach the user_id later.
	if (token.user_id) {
		return TokenModel.findOneAndUpdate(
			{ user_id: token.user_id },
			{ $set: update },
			{ upsert: true, new: true }
		).exec();
	}

	// Create a new token doc without a user_id; caller can attach user_id later
	const created = await TokenModel.create(update as unknown as TokenInput);
	return created;
}

// Attach a user_id to an existing token document (useful when the user_id is
// obtained after exchanging an OAuth code). Returns the updated document.
export async function attachUserIdToToken(tokenDocId: string, userId: string) {
	return TokenModel.findByIdAndUpdate(tokenDocId, { $set: { user_id: userId } }, { new: true }).exec();
}

export async function deleteTokenByUserId(userId: string) {
	return TokenModel.deleteOne({ user_id: userId }).exec();
}

// Example helper that exchanges a code for tokens using the configured authURL axios instance.
export async function exchangeCodeForToken(code: string, redirectUri: string, clientId: string, clientSecret: string) {
	const params = new URLSearchParams();
	params.set('client_id', clientId);
	params.set('client_secret', clientSecret);
	params.set('code', code);
	params.set('grant_type', 'authorization_code');
	params.set('redirect_uri', redirectUri);

	const res = await authURL.post('/token', params.toString(), {
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
	});

	return res.data;
}
