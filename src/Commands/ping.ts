export default {
  name: 'ping',
  description: 'Replies with pong!',
  cooldownMs: 2000,
  async execute(ctx: { channel: string; args: string[]; chatManager: any }) {
    const ch = ctx.channel;
    try {
      ctx.chatManager.sendMessage(ch, 'pong!');
    } catch (err) {
      // best-effort; logger is available on outer scope during invocation
    }
  },
};
