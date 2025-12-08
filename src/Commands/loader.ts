import fs from 'fs';
import path from 'path';

export type Command = {
  name: string;
  description?: string;
  aliases?: string[];
  cooldownMs?: number;
  execute: (ctx: any) => any;
};

// Load commands from a directory. Returns a Map keyed by lowercase name/alias -> command
export function loadCommands(commandsDir: string, logger?: any): Map<string, Command> {
  const commands = new Map<string, Command>();
  try {
    if (!fs.existsSync(commandsDir)) return commands;
    for (const file of fs.readdirSync(commandsDir)) {
      if (!file.endsWith('.js') && !file.endsWith('.ts')) continue;
      try {
        // require the module so it works in ts-node and node
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(path.join(commandsDir, file));
        const cmd = mod && (mod.default || mod) as Command;
        if (!cmd || typeof cmd.name !== 'string' || typeof cmd.execute !== 'function') {
          logger?.warn?.({ file }, 'Skipping invalid chat command (missing name or execute)');
          continue;
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
        logger?.info?.({ command: cmd.name }, 'Loaded chat command');
      } catch (err) {
        logger?.warn?.({ err: String(err), file }, 'Failed to load chat command file');
      }
    }
  } catch (err) {
    logger?.warn?.({ err: String(err) }, 'Failed to read commands directory');
  }
  return commands;
}

export default loadCommands;
