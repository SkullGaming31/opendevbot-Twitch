import EventEmitter from 'events';
import WebSocket from 'ws';

export type EventSubMessage = {
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  type?: string;
  [k: string]: unknown;
};

function getMessageTypeFromMetadata(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const m = metadata as Record<string, unknown>;
  // Twitch sometimes sends message_type in metadata; try common keys.
  const val = m['message_type'] ?? m['messageType'] ?? m['message-type'];
  return typeof val === 'string' ? val : undefined;
}

export interface EventSubClientOptions {
  url?: string; // websocket url, default to Twitch EventSub websocket endpoint
  reconnectIntervalMs?: number;
}

/**
 * Minimal EventSub WebSocket client.
 *
 * This provides a lightweight wrapper around the Twitch EventSub websocket
 * transport. It handles connecting, auto-reconnect, basic message parsing
 * and emits high-level events so other parts of the application can react.
 *
 * Note: subscribing to specific topics using the REST API is still required
 * for many workflows. This client focuses on the websocket transport and
 * message delivery flow; helper methods for creating subscriptions can be
 * added here (they typically call Twitch REST endpoints).
 */
export class EventSubClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private opts: Required<EventSubClientOptions>;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(opts?: EventSubClientOptions) {
    super();
    this.opts = { url: 'wss://eventsub.wss.twitch.tv/ws', reconnectIntervalMs: 5_000, ...(opts ?? {}) };
  }

  connect() {
    if (this.ws) return;
    this.closed = false;
    this.createSocket();
  }

  disconnect() {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.emit('disconnected');
  }

  private createSocket() {
    this.ws = new WebSocket(this.opts.url);
    this.ws.on('open', () => this.onOpen());
    this.ws.on('message', (d) => this.onMessage(d));
    this.ws.on('close', (code, reason) => this.onClose(code, reason));
    this.ws.on('error', (err) => this.onError(err));
  }

  private onOpen() {
    this.emit('connected');
  }

  private onMessage(data: WebSocket.Data) {
    let text: string;
    if (typeof data === 'string') text = data;
    else if (data instanceof Buffer) text = data.toString('utf8');
    else text = String(data);

    try {
      const msg = JSON.parse(text) as EventSubMessage;
      const t = msg.type ?? getMessageTypeFromMetadata(msg.metadata) ?? 'unknown';
      // Emit raw message and a typed shortcut
      this.emit('raw', msg);
      this.emit(t as string, msg);
    } catch {
      this.emit('error', new Error('Failed to parse EventSub message'));
    }
  }

  private onClose(code: number, reason: Buffer) {
    this.ws = null;
    this.emit('disconnected', { code, reason: reason?.toString?.() });
    if (!this.closed) {
      this.scheduleReconnect();
    }
  }

  private onError(err: Error) {
    this.emit('error', err);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closed) this.createSocket();
    }, this.opts.reconnectIntervalMs);
  }

  // Send a message to the websocket server.
  // Consumer should pass a serializable object.
  send(obj: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Placeholder helper: request that the server subscribe to a topic.
   *
   * Twitch's recommended approach is to create subscriptions via the REST
   * API; the websocket transport is primarily used for receiving events and
   * session lifecycle messages. This method is left as a convenience hook
   * for callers who want a single place to centralize subscription logic.
   */
  async subscribe(topic: Record<string, unknown>) {
    // For now just emit the request locally — implementers can call the
    // Twitch REST endpoints from here and/or send a listen message on the
    // websocket if needed by a custom broker.
    this.emit('subscribe.request', topic);
  }
}

export default EventSubClient;
