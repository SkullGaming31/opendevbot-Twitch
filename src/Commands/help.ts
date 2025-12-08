export default {
  name: 'help',
  description: 'Lists available commands',
  aliases: ['commands'],
  cooldownMs: 1000,
  async execute(ctx: any) {
    try {
      // ctx.commands is the Map<string, command> passed by the loader
      const commandsMap: Map<string, any> = ctx.commands;
      if (!commandsMap) {
        // fallback: try to read from chatManager
        const cmds = ctx.chatManager && (ctx.chatManager as any).__commands;
        if (cmds && typeof cmds.values === 'function') {
          return ctx.chatManager.sendMessage(ctx.channel, 'Available commands: ' + Array.from(new Set(Array.from(cmds.values()).map((c: any) => `!${c.name} - ${c.description || ''}`))).join(' | '));
        }
        return ctx.chatManager.sendMessage(ctx.channel, 'No commands available.');
      }

      // commandsMap includes aliases mapping to same command object; dedupe by command.name
      const seen = new Set<string>();
      const list: string[] = [];
      for (const cmd of commandsMap.values()) {
        if (!cmd || !cmd.name) continue;
        if (seen.has(cmd.name)) continue;
        seen.add(cmd.name);
        list.push(`!${cmd.name}${cmd.description ? ' - ' + cmd.description : ''}`);
      }

      if (list.length === 0) {
        return ctx.chatManager.sendMessage(ctx.channel, 'No commands available.');
      }

      // join into a single message (trim if too long)
      let message = 'Commands: ' + list.join(' | ');
      if (message.length > 450) {
        message = message.slice(0, 440) + '...';
      }
      return ctx.chatManager.sendMessage(ctx.channel, message);
    } catch (err) {
      // best-effort
      try {
        return ctx.chatManager.sendMessage(ctx.channel, 'Error listing commands');
      } catch { }
    }
  },
};
