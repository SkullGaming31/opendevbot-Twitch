import { defineCommand, CommandContext } from '../Types/types';

export default defineCommand({
  name: 'ping',
  description: 'Replies with pong!',
  cooldownMs: 2000,
  permission: ['mod', 'broadcaster'],
  async execute(ctx: CommandContext) {
    const ch = ctx.channel;
    try {
      await Promise.resolve(ctx.chatManager.sendMessage?.(ch, 'pong!'));
    } catch {
      // best-effort; ignore failures sending pong
      return;
    }
  },
});
