import EventEmitter from 'events';
import logger from '../logger';
import TwitchChatClient from './TwitchChatClient';
import { TokenModel } from '../Database';
import { helix } from '../auth/API';

export interface ChatManagerOptions {
  botToken?: string; // full token or oauth: prefix
  botNick?: string;
  botUserId?: string; // use DB token for this user id if botToken not provided
  autoJoinFromDB?: boolean; // join channels for tokens stored in DB
  // Rate limit settings
  perChannelWindowMs?: number; // default 30s
  perChannelCapacity?: number; // default 20 per window
  privilegedCapacity?: number; // default 100 per window
}

class ChatManager extends EventEmitter {
  private client: TwitchChatClient | null = null;
  private opts: ChatManagerOptions;
  private running = false;
  private sendQueue: Array<{ channel: string; text: string; enqueued: number }> = [];
  private channelState: Map<string, {
    // small bucket (counts all messages) — default cap 20 per window
    smallTokens: number;
    smallCap: number;
    // privileged bucket (additional allowance for mod/broadcaster/VIP) — default cap 100 per window
    privilegedTokens: number;
    privilegedCap: number;
    lastRefill: number;
    lastSent: number | null;
    privileged: boolean;
  }> = new Map();
  private dispatcher: NodeJS.Timeout | null = null;

  constructor(opts?: ChatManagerOptions) {
    super();
    this.opts = opts ?? {};
  }

  async start() {
    if (this.running) return;
    this.running = true;

    // Determine bot token: prefer explicit option, then env, then DB by user id
    let token = this.opts.botToken ?? process.env.CHAT_BOT_OAUTH;
    let nick = this.opts.botNick ?? process.env.CHAT_BOT_NICK ?? process.env.BOT_NICK;

    const botUserId = this.opts.botUserId ?? process.env.CHAT_BOT_USER_ID;
    if (!token && botUserId) {
      const doc = await TokenModel.findOne({ user_id: botUserId }).exec();
      token = doc?.access_token as any;
      if (token) logger.info({ botUserId }, 'Loaded bot token from DB');
    }

    if (!token) {
      logger.warn('Chat manager not started — no bot token configured (CHAT_BOT_OAUTH or botUserId)');
      return;
    }

    if (!nick) {
      // try resolving bot login via helix
      try {
        const clientId = process.env.TWITCH_CLIENT_ID ?? process.env.CLIENT_ID ?? '';
        const botToken = token.startsWith('oauth:') ? token.slice('oauth:'.length) : token;
        const r = await helix.get('/users', {
          headers: { Authorization: `Bearer ${botToken}`, 'Client-Id': clientId },
        });
        const login = r?.data?.data?.[0]?.login;
        nick = login ?? nick;
      } catch (e) {
        logger.warn({ err: String(e) }, 'Could not resolve bot login from Helix');
      }
    }

    this.client = new TwitchChatClient();
    this.client.on('connected', () => this.emit('connected'));
    this.client.on('raw', (m) => this.emit('raw', m));
    this.client.on('message', (m) => this.emit('message', m));
    this.client.on('error', (e) => this.emit('error', e));
    this.client.on('disconnected', (d) => this.emit('disconnected', d));

    this.client.connectWithToken(token as string, nick ?? 'opendevbot');

    if (this.opts.autoJoinFromDB || process.env.CHAT_AUTOJOIN === 'true') {
      // find all tokens with a user_id and ask Helix for their login to join
      try {
        const tokens = await TokenModel.find({ user_id: { $exists: true } }).exec();
        const clientId = process.env.TWITCH_CLIENT_ID ?? process.env.CLIENT_ID ?? '';
        const botToken = token.startsWith('oauth:') ? token.slice('oauth:'.length) : token;
        for (const t of tokens) {
          try {
            const userId = (t as any).user_id;
            // Skip joining the bot's own channel
            if (botUserId && String(userId) === String(botUserId)) {
              continue;
            }

            const r = await helix.get('/users', {
              params: { id: userId },
              headers: { Authorization: `Bearer ${botToken}`, 'Client-Id': clientId },
            });
            const login = r?.data?.data?.[0]?.login;
            if (login) {
              // If login matches the bot nick, skip joining to avoid joining its own channel
              if (nick && String(login).toLowerCase() === String(nick).toLowerCase()) {
                continue;
              }

              const channel = `#${login}`;
              this.client?.join(channel);
              logger.info({ channel }, 'chat manager joined channel');
            }
          } catch (inner) {
            logger.warn({ err: String(inner) }, 'Failed to resolve/join channel for token');
          }
        }
      } catch (err) {
        logger.warn({ err: String(err) }, 'chat manager could not query tokens for auto-join');
      }
    }

    // ready
    logger.info('Chat manager started');

    // start dispatcher for send queue
    const windowMs = this.opts.perChannelWindowMs ?? 30_000;
    const capacity = this.opts.perChannelCapacity ?? 20;
    const privilegedCapacity = this.opts.privilegedCapacity ?? 100;
    // initialize channelState for channels already joined if any
    // Start dispatcher loop
    this.dispatcher = setInterval(() => {
      try {
        this.dispatchCycle(windowMs, capacity, privilegedCapacity);
      } catch (e) {
        logger.warn({ err: String(e) }, 'chat dispatcher error');
      }
    }, 250);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    if (this.dispatcher) {
      clearInterval(this.dispatcher);
      this.dispatcher = null;
    }
    logger.info('Chat manager stopped');
  }

  join(channel: string) {
    if (!this.client) throw new Error('Chat not started');
    this.client.join(channel);
    const ch = channel.startsWith('#') ? channel : `#${channel}`;
    if (!this.channelState.has(ch)) {
      const smallCap = this.opts.perChannelCapacity ?? 20;
      const privilegedCap = this.opts.privilegedCapacity ?? 100;
      this.channelState.set(ch, {
        smallTokens: smallCap,
        smallCap,
        privilegedTokens: this.opts.privilegedCapacity ? privilegedCap : 0,
        privilegedCap: this.opts.privilegedCapacity ? privilegedCap : 0,
        lastRefill: Date.now(),
        lastSent: null,
        privileged: false,
      });
    }
  }

  part(channel: string) {
    if (!this.client) throw new Error('Chat not started');
    this.client.part(channel);
    const ch = channel.startsWith('#') ? channel : `#${channel}`;
    this.channelState.delete(ch);
  }

  // Enqueue a message to be sent respecting rate limits
  sendMessage(channel: string, text: string) {
    const ch = channel.startsWith('#') ? channel : `#${channel}`;
    if (!this.running) throw new Error('Chat not started');
    // Ensure channel state exists
    if (!this.channelState.has(ch)) {
      const smallCap = this.opts.perChannelCapacity ?? 20;
      const privilegedCap = this.opts.privilegedCapacity ?? 100;
      this.channelState.set(ch, {
        smallTokens: smallCap,
        smallCap,
        privilegedTokens: this.opts.privilegedCapacity ? privilegedCap : 0,
        privilegedCap: this.opts.privilegedCapacity ? privilegedCap : 0,
        lastRefill: Date.now(),
        lastSent: null,
        privileged: false,
      });
    }
    this.sendQueue.push({ channel: ch, text, enqueued: Date.now() });
  }

  // Mark a channel as privileged (e.g., bot is mod/broadcaster/VIP)
  setChannelPrivilege(channel: string, privileged: boolean) {
    const ch = channel.startsWith('#') ? channel : `#${channel}`;
    const state = this.channelState.get(ch);
    if (state) state.privileged = privileged;
    else {
      const smallCap = this.opts.perChannelCapacity ?? 20;
      const privilegedCap = this.opts.privilegedCapacity ?? 100;
      this.channelState.set(ch, {
        smallTokens: smallCap,
        smallCap,
        privilegedTokens: privileged ? privilegedCap : 0,
        privilegedCap: privileged ? privilegedCap : 0,
        lastRefill: Date.now(),
        lastSent: null,
        privileged,
      });
    }
  }

  private dispatchCycle(windowMs: number, defaultCapacity: number, privilegedCapacity: number) {
    const now = Date.now();
    const sendLimitPerTick = 10; // avoid sending too many in one tick
    let sent = 0;

    for (let i = 0; i < this.sendQueue.length && sent < sendLimitPerTick;) {
      const item = this.sendQueue[i];
      if (!item) { i += 1; continue; }
      const state = this.channelState.get(item.channel) ?? {
        smallTokens: defaultCapacity,
        smallCap: defaultCapacity,
        privilegedTokens: 0,
        privilegedCap: 0,
        lastRefill: now,
        lastSent: null,
        privileged: false,
      };

      // ensure caps reflect potential privilege
      state.smallCap = defaultCapacity;
      if (state.privileged) {
        state.privilegedCap = privilegedCapacity;
        if (typeof state.privilegedTokens !== 'number') state.privilegedTokens = privilegedCapacity;
      } else {
        state.privilegedCap = 0;
      }

      // refill both buckets proportionally
      const delta = now - (state.lastRefill || now);
      if (delta > 0) {
        const smallRefillRate = state.smallCap / windowMs; // tokens per ms
        state.smallTokens = Math.min(state.smallCap, (state.smallTokens || 0) + delta * smallRefillRate);
        if (state.privilegedCap > 0) {
          const privRefillRate = state.privilegedCap / windowMs;
          state.privilegedTokens = Math.min(state.privilegedCap, (state.privilegedTokens || 0) + delta * privRefillRate);
        }
        state.lastRefill = now;
      }

      const minInterval = state.privileged ? 0 : 1000; // 1 msg/sec per channel for non-privileged

      // Determine if we can send:
      // - Non-privileged: need smallTokens >= 1 and respect minInterval
      // - Privileged: allowed if either smallTokens >=1 OR privilegedTokens >=1 (and respect minInterval only for non-privileged)
      const hasSmall = (state.smallTokens || 0) >= 1;
      const hasPriv = (state.privilegedTokens || 0) >= 1;
      const canSend = (state.privileged ? (hasSmall || hasPriv) : hasSmall) && (state.lastSent === null || (now - state.lastSent) >= minInterval);

      if (canSend && this.client) {
        try {
          this.client.sendMessage(item.channel, item.text);
          // decrement tokens appropriately
          if (hasSmall) state.smallTokens = (state.smallTokens || 0) - 1;
          // privileged messages also count toward the large bucket if available
          if (state.privileged && hasPriv) state.privilegedTokens = Math.max(0, (state.privilegedTokens || 0) - 1);
          state.lastSent = now;
          this.channelState.set(item.channel, state);
          // remove from queue
          this.sendQueue.splice(i, 1);
          sent += 1;
          continue;
        } catch (e) {
          logger.warn({ err: String(e) }, 'Failed sending chat message');
          this.sendQueue.splice(i, 1);
          continue;
        }
      }

      // cannot send yet, move to next queue item
      i += 1;
    }
  }
}

const defaultManager = new ChatManager({ autoJoinFromDB: true });
export default defaultManager;
