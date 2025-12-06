import mongoose, { Schema, model, Document } from 'mongoose';

// Plain token attributes (used for inputs / DTOs)
export interface TokenAttrs {
  user_id: string;
  access_token: string;
  refresh_token?: string;
  scopes?: string[];
  expires_at?: Date | string;
  obtained_at?: Date | string;
  // Number of consecutive refresh failures
  retry_count?: number;
  // When true, the token will be skipped by refresh worker
  disabled?: boolean;
}

export interface IToken extends Document {
  user_id: string;
  access_token: string;
  refresh_token?: string;
  scopes: string[];
  expires_at?: Date;
  obtained_at?: Date;
  retry_count?: number;
  disabled?: boolean;
}

const TokenSchema = new Schema<IToken>({
  // `user_id` may not be available at token-creation time (we obtain it later from Twitch APIs).
  // Make it optional so we can persist tokens first and attach the user_id later.
  user_id: { type: String, required: false, index: true },
  access_token: { type: String, required: true },
  refresh_token: { type: String },
  scopes: { type: [String], default: [] },
  expires_at: { type: Date },
  obtained_at: { type: Date },
  retry_count: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false },
});

// Avoid model overwrite errors when tests reset modules: reuse existing model if present.
export const TokenModel = (mongoose.models && (mongoose.models as any).Token)
  ? (mongoose.models as any).Token
  : model<IToken>('Token', TokenSchema);

// Helper input type for create/update operations
// TokenInput allows creating/updating tokens. `user_id` is optional because
// some flows obtain tokens first and resolve the user identity later.
export type TokenInput = Partial<TokenAttrs> & { user_id?: string };

// When a token is created before the user_id is known, the created document's
// `_id` can be used to attach the `user_id` later with `attachUserIdToToken`.
