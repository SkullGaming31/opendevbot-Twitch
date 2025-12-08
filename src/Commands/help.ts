import { defineCommand, CommandContext, Command, ChatTags } from '../Types/types';
import { isAllowedByPermission } from './core/permission';

export default defineCommand({
  name: 'help',
  description: 'Lists available commands',
  aliases: ['commands'],
  cooldownMs: 1000,
  permission: 'everyone',
  async execute(ctx: CommandContext) {
    try {
      // ctx.commands is the Map<string, command> passed by the loader
      const commandsMap: Map<string, Command> | undefined = ctx.commands;
      if (!commandsMap) {
        // fallback: try to read from chatManager
        const cmds = ctx.chatManager && (ctx.chatManager as unknown as { __commands?: Map<string, Command> }).__commands;
        if (cmds && typeof cmds.values === 'function') {
          const arr = Array.from(cmds.values()) as unknown as Command[];
          return ctx.chatManager.sendMessage?.(ctx.channel, 'Available commands: ' + Array.from(new Set(arr.map((c: Command) => `!${c.name} - ${c.description || ''}`))).join(' | '));
        }
        return ctx.chatManager.sendMessage?.(ctx.channel, 'No commands available.');
      }

      // commandsMap includes aliases mapping to same command object; dedupe by command.name
      const seen = new Set<string>();
      const list: string[] = [];
      for (const cmd of commandsMap.values()) {
        if (!cmd || !cmd.name) continue;
        if (seen.has(cmd.name)) continue;
        seen.add(cmd.name);
        // If caller tags are available (ctx.tags or ctx.raw.tags), filter commands by permission.
        // If no caller tags are provided (e.g., called from admin tooling), show all commands.
        const callerTags = (((ctx && (ctx.tags || (ctx.raw && ((ctx.raw as unknown) as { tags?: unknown }).tags))) || null) as unknown) as ChatTags | null;
        if (callerTags) {
          const allowed = isAllowedByPermission(callerTags, cmd.permission, process.env.OWNER_USER_ID);
          if (!allowed) continue;
        }
        const perm = cmd.permission ? ` (${Array.isArray(cmd.permission) ? (cmd.permission.join('|')) : cmd.permission})` : '';
        list.push(`!${cmd.name}${cmd.description ? ' - ' + cmd.description : ''}${perm}`);
      }

      if (list.length === 0) {
        return ctx.chatManager.sendMessage?.(ctx.channel, 'No commands available.');
      }

      // join into a single message (trim if too long)
      let message = 'Commands: ' + list.join(' | ');
      if (message.length > 450) {
        message = message.slice(0, 440) + '...';
      }
      return ctx.chatManager.sendMessage?.(ctx.channel, message);
    } catch {
      // best-effort: try to notify, but don't swallow errors silently
      try {
        return ctx.chatManager.sendMessage?.(ctx.channel, 'Error listing commands');
      } catch {
        return undefined;
      }
    }
  },
});
