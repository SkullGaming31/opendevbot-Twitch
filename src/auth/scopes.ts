// Centralized Twitch scope constants and helpers
export const SCOPES = {
  CHAT_READ: 'chat:read',
  CHAT_EDIT: 'chat:edit',
  USER_READ_FOLLOWS: 'user:read:follows',
  CHANNEL_BOT: 'channel:bot',
  USER_BOT: 'user:bot',
  // channel:* scopes (common examples)
  CHANNEL_READ_ADS: 'channel:read:ads',
  CHANNEL_MANAGE_BROADCAST: 'channel:manage:broadcast',
  CHANNEL_READ_CHARITY: 'channel:read:charity',
  CHANNEL_MANAGE_CLIPS: 'channel:manage:clips',
  CHANNEL_EDIT_COMMERCIAL: 'channel:edit:commercial',
  CHANNEL_READ_EDITORS: 'channel:read:editors',
  CHANNEL_MANAGE_EXTENSIONS: 'channel:manage:extensions',
  CHANNEL_READ_GOALS: 'channel:read:goals',
  CHANNEL_MANAGE_GUEST_STAR: 'channel:manage:guest_star',
  CHANNEL_READ_HYPE_TRAIN: 'channel:read:hype_train',
  CHANNEL_MANAGE_MODERATORS: 'channel:manage:moderators',
  CHANNEL_READ_POLLS: 'channel:read:polls',
  CHANNEL_MANAGE_POLLS: 'channel:manage:polls',
  CHANNEL_READ_PREDICTIONS: 'channel:read:predictions',
  CHANNEL_MANAGE_PREDICTIONS: 'channel:manage:predictions',
  CHANNEL_MANAGE_RAIDS: 'channel:manage:raids',
  CHANNEL_READ_REDEMPTIONS: 'channel:read:redemptions',
  CHANNEL_MANAGE_REDEMPTIONS: 'channel:manage:redemptions',
  CHANNEL_MANAGE_SCHEDULE: 'channel:manage:schedule',
  CHANNEL_READ_STREAM_KEY: 'channel:read:stream_key',
  CHANNEL_READ_SUBSCRIPTIONS: 'channel:read:subscriptions',
  CHANNEL_MANAGE_VIDEOS: 'channel:manage:videos',
  CHANNEL_READ_VIPS: 'channel:read:vips',
  CHANNEL_MANAGE_VIPS: 'channel:manage:vips',
  CHANNEL_MODERATE: 'channel:moderate',

  // moderator:* and moderation-related scopes
  MODERATION_READ: 'moderation:read',
  MODERATOR_MANAGE_ANNOUNCEMENTS: 'moderator:manage:announcements',
  MODERATOR_MANAGE_AUTOMOD: 'moderator:manage:automod',
  MODERATOR_READ_AUTOMOD_SETTINGS: 'moderator:read:automod_settings',
  MODERATOR_MANAGE_AUTOMOD_SETTINGS: 'moderator:manage:automod_settings',
  MODERATOR_READ_BANNED_USERS: 'moderator:read:banned_users',
  MODERATOR_MANAGE_BANNED_USERS: 'moderator:manage:banned_users',
  MODERATOR_READ_BLOCKED_TERMS: 'moderator:read:blocked_terms',
  MODERATOR_READ_CHAT_MESSAGES: 'moderator:read:chat_messages',
  MODERATOR_MANAGE_BLOCKED_TERMS: 'moderator:manage:blocked_terms',
  MODERATOR_MANAGE_CHAT_MESSAGES: 'moderator:manage:chat_messages',
  MODERATOR_READ_CHAT_SETTINGS: 'moderator:read:chat_settings',
  MODERATOR_MANAGE_CHAT_SETTINGS: 'moderator:manage:chat_settings',
  MODERATOR_READ_CHATTERS: 'moderator:read:chatters',
  MODERATOR_READ_FOLLOWERS: 'moderator:read:followers',
  MODERATOR_READ_GUEST_STAR: 'moderator:read:guest_star',
  MODERATOR_MANAGE_GUEST_STAR: 'moderator:manage:guest_star',
  MODERATOR_READ_MODERATORS: 'moderator:read:moderators',
  MODERATOR_READ_SHIELD_MODE: 'moderator:read:shield_mode',
  MODERATOR_MANAGE_SHIELD_MODE: 'moderator:manage:shield_mode',
  MODERATOR_READ_SHOUTOUTS: 'moderator:read:shoutouts',
  MODERATOR_MANAGE_SHOUTOUTS: 'moderator:manage:shoutouts',
  MODERATOR_READ_SUSPICIOUS_USERS: 'moderator:read:suspicious_users',
  MODERATOR_READ_UNBAN_REQUESTS: 'moderator:read:unban_requests',
  MODERATOR_MANAGE_UNBAN_REQUESTS: 'moderator:manage:unban_requests',
  MODERATOR_READ_VIPS: 'moderator:read:vips',
  MODERATOR_READ_WARNINGS: 'moderator:read:warnings',
  MODERATOR_MANAGE_WARNINGS: 'moderator:manage:warnings',
} as const;

export type ScopeValue = typeof SCOPES[keyof typeof SCOPES];

// Common grouped scope sets for convenience
export const CHANNEL_SCOPES: ScopeValue[] = [
  SCOPES.CHANNEL_READ_ADS,
  SCOPES.CHANNEL_MANAGE_BROADCAST,
  SCOPES.CHANNEL_READ_CHARITY,
  SCOPES.CHANNEL_MANAGE_CLIPS,
  SCOPES.CHANNEL_EDIT_COMMERCIAL,
  SCOPES.CHANNEL_READ_EDITORS,
  SCOPES.CHANNEL_MANAGE_EXTENSIONS,
  SCOPES.CHANNEL_READ_GOALS,
  SCOPES.CHANNEL_MANAGE_GUEST_STAR,
  SCOPES.CHANNEL_READ_HYPE_TRAIN,
  SCOPES.CHANNEL_MANAGE_MODERATORS,
  SCOPES.CHANNEL_READ_POLLS,
  SCOPES.CHANNEL_MANAGE_POLLS,
  SCOPES.CHANNEL_READ_PREDICTIONS,
  SCOPES.CHANNEL_MANAGE_PREDICTIONS,
  SCOPES.CHANNEL_MANAGE_RAIDS,
  SCOPES.CHANNEL_READ_REDEMPTIONS,
  SCOPES.CHANNEL_MANAGE_REDEMPTIONS,
  SCOPES.CHANNEL_MANAGE_SCHEDULE,
  SCOPES.CHANNEL_READ_STREAM_KEY,
  SCOPES.CHANNEL_READ_SUBSCRIPTIONS,
  SCOPES.CHANNEL_MANAGE_VIDEOS,
  SCOPES.CHANNEL_READ_VIPS,
  SCOPES.CHANNEL_MANAGE_VIPS,
  SCOPES.CHANNEL_MODERATE,
];

export const MODERATION_SCOPES: ScopeValue[] = [
  SCOPES.MODERATION_READ,
  SCOPES.MODERATOR_MANAGE_ANNOUNCEMENTS,
  SCOPES.MODERATOR_MANAGE_AUTOMOD,
  SCOPES.MODERATOR_READ_AUTOMOD_SETTINGS,
  SCOPES.MODERATOR_MANAGE_AUTOMOD_SETTINGS,
  SCOPES.MODERATOR_READ_BANNED_USERS,
  SCOPES.MODERATOR_MANAGE_BANNED_USERS,
  SCOPES.MODERATOR_READ_BLOCKED_TERMS,
  SCOPES.MODERATOR_READ_CHAT_MESSAGES,
  SCOPES.MODERATOR_MANAGE_BLOCKED_TERMS,
  SCOPES.MODERATOR_MANAGE_CHAT_MESSAGES,
  SCOPES.MODERATOR_READ_CHAT_SETTINGS,
  SCOPES.MODERATOR_MANAGE_CHAT_SETTINGS,
  SCOPES.MODERATOR_READ_CHATTERS,
  SCOPES.MODERATOR_READ_FOLLOWERS,
  SCOPES.MODERATOR_READ_GUEST_STAR,
  SCOPES.MODERATOR_MANAGE_GUEST_STAR,
  SCOPES.MODERATOR_READ_MODERATORS,
  SCOPES.MODERATOR_READ_SHIELD_MODE,
  SCOPES.MODERATOR_MANAGE_SHIELD_MODE,
  SCOPES.MODERATOR_READ_SHOUTOUTS,
  SCOPES.MODERATOR_MANAGE_SHOUTOUTS,
  SCOPES.MODERATOR_READ_SUSPICIOUS_USERS,
  SCOPES.MODERATOR_READ_UNBAN_REQUESTS,
  SCOPES.MODERATOR_MANAGE_UNBAN_REQUESTS,
  SCOPES.MODERATOR_READ_VIPS,
  SCOPES.MODERATOR_READ_WARNINGS,
  SCOPES.MODERATOR_MANAGE_WARNINGS,
];

/**
 * Join an array of scopes and URL-encode the result for use in the authorize URL.
 */
export function scopesToString(scopes: (ScopeValue | string)[]) {
  return encodeURIComponent(scopes.join(' '));
}

/**
 * Build a Twitch OAuth2 authorize URL for a user authorization flow.
 * - `clientId` and `redirectUri` are required.
 * - `scopes` is an array of scope strings.
 * - `state` is optional and recommended for CSRF protection.
 */
export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  scopes?: (ScopeValue | string)[];
  state?: string;
  forceVerify?: boolean;
}) {
  const {
    clientId,
    redirectUri,
    scopes = [
      // default to the full set of channel + moderation scopes for the bot
      ...CHANNEL_SCOPES,
      ...MODERATION_SCOPES
    ],
    state,
    forceVerify,
  } = opts;
  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('redirect_uri', redirectUri);
  params.set('response_type', 'code');
  params.set('scope', scopes.join(' '));
  if (state) params.set('state', state);
  if (forceVerify) params.set('force_verify', 'true');

  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}
