import fs from 'fs';
import path from 'path';
import type { Command as CommandType } from '../../Types/types';

type LoggerLike = { info?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void };

// Load commands from a directory. Returns a Map keyed by lowercase name/alias -> command
export function loadCommands(commandsDir: string, logger?: LoggerLike): Map<string, CommandType> {
  const commands = new Map<string, CommandType>();
  try {
    if (!fs.existsSync(commandsDir)) return commands;
    for (const file of fs.readdirSync(commandsDir)) {
      if (!file.endsWith('.js') && !file.endsWith('.ts')) continue;
      try {
        // require the module so it works in ts-node and node
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require(path.join(commandsDir, file));
        const cmd = mod && (mod.default || mod) as CommandType;
        if (!cmd || typeof cmd.name !== 'string' || typeof cmd.execute !== 'function') {
          logger?.warn?.({ file }, 'Skipping invalid chat command (missing name or execute)');
          continue;
        }
        // validate optional permission metadata
        const allowedRoles = ['owner', 'broadcaster', 'mod', 'vip', 'subscriber', 'everyone'];
        if (cmd.permission !== undefined) {
          const p = cmd.permission;
          const check = (val: unknown) => typeof val === 'string' && allowedRoles.includes(String(val));
          if (typeof p === 'string') {
            if (!check(p)) {
              logger?.warn?.({ file, permission: p }, 'Skipping command with invalid permission value');
              continue;
            }
          } else if (Array.isArray(p)) {
            if (!p.every(check)) {
              logger?.warn?.({ file, permission: p }, 'Skipping command with invalid permission array');
              continue;
            }
          } else {
            logger?.warn?.({ file, permission: p }, 'Skipping command with invalid permission type');
            continue;
          }
        }
        const nameKey = String(cmd.name).toLowerCase();
        if (commands.has(nameKey)) {
          logger?.warn?.({ name: cmd.name, file }, 'Duplicate command name, skipping');
          continue;
        }
        commands.set(nameKey, cmd);
        if (Array.isArray(cmd.aliases)) {
          for (const a of cmd.aliases) {
            const k = String(a).toLowerCase();
            if (!commands.has(k)) commands.set(k, cmd);
          }
        }
      } catch (err) {
        logger?.warn?.({ err: String(err), file }, 'Failed to load chat command file');
      }
    }
  } catch (err) {
    logger?.warn?.({ err: String(err) }, 'Failed to read commands directory');
  }
  // Log only the number of distinct commands loaded (dedupe aliases)
  try {
    const unique = new Set<string>();
    for (const c of commands.values()) {
      if (c && typeof c.name === 'string') unique.add(String(c.name));
    }
    logger?.info?.({ count: unique.size }, 'Loaded chat commands');
  } catch {
    // ignore logging errors
  }
  return commands;
}

export default loadCommands;
