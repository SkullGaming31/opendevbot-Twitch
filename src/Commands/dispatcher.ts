// Testable dispatcher: extracts the chat message handler logic so tests can
// call it directly without starting the whole chat manager.
import { isAllowedByPermission, ChatTags } from './core/permission';
import type { Command as CommandType, CommandContext } from '../Types/types';

export interface ChatMessage {
  channel?: string;
  tags?: ChatTags;
  prefix?: string;
  text?: string;
  params?: string[];
  [key: string]: unknown;
}

export interface MinimalChatManager {
  setChannelPrivilege?: (channel: string, privileged: boolean) => void;
  sendMessage?: (channel: string, text: string) => Promise<void> | void;
  __commands?: Map<string, CommandType>;
  __commandLastUsed?: Map<string, number>;
  [key: string]: unknown;
}

type LoggerLike = { info?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void; debug?: (...args: unknown[]) => void };

export async function handleMessage(m: ChatMessage, chatManager: MinimalChatManager, logger: LoggerLike) {
  try {
    const channel = m.channel ?? '<unknown>';
    const display = (m.tags && (m.tags['display-name'] || m.tags['login'])) || m.prefix || 'unknown';
    const text = m.text ?? (m.params && m.params[1]) ?? '';

    // Log common chat fields; include full parsed message when opt-in
    const logPayload: Record<string, unknown> = { channel, display, text };
    if (process.env.CHAT_LOG_FULL === 'true') {
      logPayload.message = m;
    }
    logger?.info?.(logPayload, 'chat message');

    // Auto-detect privilege from tags and update rate-limiter
    try {
      const badgesRaw = m.tags && m.tags.badges ? String(m.tags.badges) : '';
      const badges = badgesRaw ? badgesRaw.split(',').map((b: string) => b.split('/')[0]) : [];
      const isPriv = badges.includes('broadcaster') || badges.includes('moderator') || badges.includes('vip');
      if (isPriv) chatManager.setChannelPrivilege?.(channel, true);
    } catch {
      void 0;
    }

    // Command dispatching: messages starting with '!'
    try {
      if (typeof text === 'string' && text.trim().startsWith('!')) {
        const parts = text.trim().slice(1).split(/\s+/);
        const invoked = parts[0] ? String(parts[0]).toLowerCase() : '';
        const args = parts.slice(1);
        const commands = chatManager && chatManager.__commands as Map<string, CommandType> | undefined;
        const lastUsed = chatManager && chatManager.__commandLastUsed as Map<string, number> | undefined;
        const cmd = commands?.get(invoked);
        if (cmd && typeof cmd.execute === 'function') {
          const now = Date.now();
          const cooldown = Number(cmd.cooldownMs || 0) || 0;
          const last = lastUsed?.get(cmd.name) || 0;
          if (cooldown > 0 && now - last < cooldown) {
            logger?.debug?.({ command: cmd.name, channel }, 'command on cooldown');
          } else {
            try {
              const perm = cmd.permission;
              const allowed = isAllowedByPermission(m.tags as ChatTags | undefined, perm, process.env.OWNER_USER_ID);
              if (!allowed) {
                try {
                  const who = (m.tags && (m.tags['display-name'] || m.tags['login'])) || display || '';
                  chatManager.sendMessage?.(channel, `@${who} you don't have permission to use that command.`);
                } catch {
                  void 0;
                }
              } else {
                // mark usage now that permission was granted
                lastUsed?.set(cmd.name, now);
                await Promise.resolve(cmd.execute({ channel, display, text, args, chatManager, raw: m, logger, commands: chatManager.__commands } as CommandContext))
                  .catch((err: unknown) => logger?.warn?.({ err: String(err), command: cmd.name }, 'chat command execution failed'));
              }
            } catch (ex) {
              logger?.warn?.({ err: String(ex), command: cmd.name }, 'chat command execution error');
            }
          }
        }
      }
    } catch (e) {
      logger?.warn?.({ err: String(e) }, 'chat command handler failed');
    }
  } catch (e) {
    logger?.warn?.({ err: String(e) }, 'chat message handler failed');
  }
}

export default { handleMessage };
