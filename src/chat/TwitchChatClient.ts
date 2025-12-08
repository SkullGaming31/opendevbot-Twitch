import WebSocket from 'ws';
import EventEmitter from 'events';
import logger from '../logger';

export interface ChatClientOptions {
  server?: string; // websocket url
  reconnectDelayMs?: number;
}

export interface IRCMessage {
  raw: string;
  prefix?: string;
  command?: string;
  params?: string[];
  tags?: Record<string, string> | null;
}

function parseIRCLine(line: string): IRCMessage {
  // Minimal IRC parsing with support for tags
  // @tag1=val;tag2=val :prefix COMMAND params :trailing
  let rest = line;
  let tags: Record<string, string> | null = null;
  if (rest.startsWith('@')) {
    const idx = rest.indexOf(' ');
    const rawTags = idx === -1 ? rest.slice(1) : rest.slice(1, idx);
    tags = {};
    for (const pair of rawTags.split(';')) {
      const [kRaw, vRaw] = pair.split('=');
      if (!kRaw) continue;
      const key = String(kRaw);
      tags[key] = vRaw ?? '';
    }
    rest = idx === -1 ? '' : rest.slice(idx + 1);
  }

  let prefix: string | undefined;
  if (rest.startsWith(':')) {
    const idx = rest.indexOf(' ');
    if (idx === -1) {
      prefix = rest.slice(1);
      rest = '';
    } else {
      prefix = rest.slice(1, idx);
      rest = rest.slice(idx + 1);
    }
  }

  const parts: string[] = [];
  while (rest.length > 0) {
    if (rest.startsWith(':')) {
      parts.push(rest.slice(1));
      break;
    }
    const idx = rest.indexOf(' ');
    if (idx === -1) {
      parts.push(rest);
      break;
    }
    parts.push(rest.slice(0, idx));
    rest = rest.slice(idx + 1);
  }

  const command = parts.shift();

  return { raw: line, prefix, command, params: parts, tags } as IRCMessage;
}

export class TwitchChatClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private opts: ChatClientOptions;
  private token?: string;
  private nick?: string;
  private joined: Set<string> = new Set();
  private closed = false;

  constructor(opts?: ChatClientOptions) {
    super();
    this.opts = { server: 'wss://irc-ws.chat.twitch.tv:443', reconnectDelayMs: 5000, ...(opts ?? {}) };
  }

  connectWithToken(token: string, nick: string) {
    this.token = token.startsWith('oauth:') ? token : `oauth:${token}`;
    this.nick = nick;
    this.closed = false;
    this.openSocket();
  }

  private openSocket() {
    if (!this.token || !this.nick) throw new Error('token and nick required');
    const url = this.opts.server as string;
    logger.info({ url }, 'chat connecting');
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      logger.info('chat websocket open');
      // Optional, immediate console debug for troubleshooting connection visibility
      try {
        if (process.env.CHAT_DEBUG_RAW as string === 'true' || process.env.LOG_TO_CONSOLE as string === 'true') {
          // console.log('[chat] websocket open', { nick: this.nick });
        }
      } catch (e) {
        logger?.debug?.({ err: String(e) }, 'chat websocket open debug failed');
      }
      // Authenticate
      this.sendRaw(`PASS ${this.token}`);
      this.sendRaw(`NICK ${this.nick}`);
      // Request capabilities
      this.sendRaw('CAP REQ :twitch.tv/membership twitch.tv/tags twitch.tv/commands');
      // Re-join any previously joined channels
      for (const ch of this.joined) {
        this.sendRaw(`JOIN ${ch}`);
      }
      this.emit('connected');
    });

    this.ws.on('message', (data) => {
      const text = (data as Buffer).toString('utf8');
      // Debug raw IRC payload to console when requested to help troubleshooting
      try {
        if (process.env.CHAT_DEBUG_RAW as string === 'true') {
          console.debug('[irc-raw]', text);
        }
      } catch (e) {
        logger?.debug?.({ err: String(e) }, 'chat raw debug failed');
      }
      for (const line of text.split(/\r?\n/)) {
        if (!line) continue;
        const msg = parseIRCLine(line);
        // respond to PING
        if (msg.command === 'PING') {
          this.sendRaw('PONG :tmi.twitch.tv');
          continue;
        }
        // Emit parsed message
        this.emit('raw', msg);
        // Common: PRIVMSG => chat message
        if (msg.command === 'PRIVMSG') {
          const channel = msg.params && msg.params[0];
          const textIdx = msg.params && msg.params[1];
          this.emit('message', { channel, text: textIdx, tags: msg.tags, prefix: msg.prefix });
        }
      }
    });

    this.ws.on('error', (err) => {
      logger.warn({ err: String(err) }, 'chat websocket error');
      this.emit('error', err);
    });

    this.ws.on('close', (code, reason) => {
      logger.info({ code, reason: reason?.toString() }, 'chat websocket closed');
      this.emit('disconnected', { code, reason: reason?.toString() });
      this.ws = null;
      if (!this.closed) {
        setTimeout(() => this.openSocket(), this.opts.reconnectDelayMs);
      }
    });
  }

  sendRaw(line: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(`${line}\r\n`);
  }

  sendMessage(channel: string, text: string) {
    const ch = channel.startsWith('#') ? channel : `#${channel}`;
    // PRIVMSG #channel :message
    this.sendRaw(`PRIVMSG ${ch} :${text}`);
  }

  // Join a channel on the existing connection
  join(channel: string) {
    const ch = channel.startsWith('#') ? channel : `#${channel}`;
    if (this.joined.has(ch)) return;
    this.joined.add(ch);
    this.sendRaw(`JOIN ${ch}`);
  }

  // Part a channel on the existing connection
  part(channel: string) {
    const ch = channel.startsWith('#') ? channel : `#${channel}`;
    if (!this.joined.has(ch)) return;
    this.joined.delete(ch);
    this.sendRaw(`PART ${ch}`);
  }

  disconnect() {
    this.closed = true;
    if (this.ws) this.ws.close();
  }
}

export default TwitchChatClient;
